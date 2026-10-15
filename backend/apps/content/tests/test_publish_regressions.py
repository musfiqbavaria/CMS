"""Publishing/delivery regressions; no Celery worker or Redis is required."""

from importlib import import_module
from unittest.mock import patch

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.connector.models import DEFAULT_SELECTORS, SelectorMapping
from apps.connector.services import (
    build_payload,
    cache_key,
    delivery_media_url,
    get_cached_payload,
    public_site,
)
from apps.content import services
from apps.sites.models import Site


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
)
class PublishRegressionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.site = Site.objects.create(
            name="Example",
            domain="example.com",
            status=Site.Statuses.ACTIVE,
            verification_status=Site.VerificationStatuses.VERIFIED,
            discovery={"title": "Original title", "description": "Original subtitle"},
        )
        services.get_or_create_config(self.site)

    def edit(self, value):
        return services.update_draft(actor=None, site=self.site, patch=value)

    def publish(self, **kwargs):
        with self.captureOnCommitCallbacks(execute=True):
            return services.publish(actor=None, site=self.site, **kwargs)

    def payload(self):
        return get_cached_payload(public_site(self.site.site_key))[0]

    def test_publish_uses_latest_autosaved_values_not_an_older_saved_draft(self):
        self.edit({"hero": {"heading": "Saved earlier"}})
        old = services.save_draft(actor=None, site=self.site)
        self.edit({"hero": {"heading": "My latest edit"}})
        live = self.publish()
        self.assertNotEqual(live.pk, old.pk)
        self.assertEqual(live.snapshot["hero"]["heading"], "My latest edit")
        self.assertEqual(self.payload()["data"]["hero"]["heading"], "My latest edit")

    def test_unchanged_saved_draft_is_reused(self):
        saved = services.save_draft(actor=None, site=self.site, note="Ready")
        self.assertEqual(self.publish().pk, saved.pk)

    def test_publish_purges_cache_at_commit_without_a_worker(self):
        self.publish()
        self.payload()
        self.assertIsNotNone(cache.get(cache_key(self.site.site_key)))
        self.edit({"hero": {"heading": "New heading"}})
        self.publish()
        self.assertIsNone(cache.get(cache_key(self.site.site_key)))
        self.assertEqual(self.payload()["data"]["hero"]["heading"], "New heading")

    def test_revision_validation_recovers_from_a_missed_purge(self):
        self.publish()
        before = self.payload()
        self.edit({"hero": {"heading": "After missed purge"}})
        with patch("apps.connector.services.purge_site_cache"):
            self.publish()
        after = self.payload()
        self.assertNotEqual(before["published_version"], after["published_version"])
        self.assertEqual(after["data"]["hero"]["heading"], "After missed purge")

    def test_mapping_revision_is_checked_even_without_a_purge(self):
        self.publish()
        self.payload()
        self.site.mappings.filter(key="hero_heading").update(
            selector=".updated-heading"
        )
        mappings = self.payload()["mappings"]
        self.assertIn({"key": "hero_heading", "selector": ".updated-heading"}, mappings)

    def test_deleted_mapping_is_not_silently_recreated(self):
        self.publish()
        self.payload()
        self.site.mappings.filter(key="hero_heading").delete()
        keys = [item["key"] for item in self.payload()["mappings"]]
        self.assertNotIn("hero_heading", keys)

    def test_delivery_survives_an_unavailable_cache(self):
        self.publish()
        with patch(
            "apps.connector.services.cache.get", side_effect=RuntimeError("offline")
        ):
            with self.assertLogs("apps.connector.services", level="WARNING"):
                self.assertEqual(self.payload()["data"]["site_name"], "Original title")

    def test_cache_purge_failure_does_not_turn_a_committed_publish_into_an_error(self):
        with patch(
            "apps.connector.services.cache.delete", side_effect=RuntimeError("offline")
        ):
            with self.assertLogs("apps.connector.services", level="WARNING"):
                version = self.publish()
        self.assertEqual(version.status, "published")

    def test_default_title_tracks_site_name_and_custom_title_is_preserved(self):
        draft = self.edit({"general": {"site_name": "New brand"}})
        self.assertEqual(draft.draft["seo"]["title"], "New brand")
        self.edit({"seo": {"title": "A custom search title"}})
        draft = self.edit({"general": {"site_name": "Another brand"}})
        self.assertEqual(draft.draft["seo"]["title"], "A custom search title")

    def test_existing_seeded_seo_title_does_not_mask_a_changed_site_name(self):
        config = services.get_or_create_config(self.site)
        config.draft["general"]["site_name"] = "Previously changed brand"
        config.save()
        self.publish()
        self.assertEqual(
            self.payload()["data"]["seo"]["title"], "Previously changed brand"
        )

    def test_logo_fields_are_synchronized_and_can_be_cleared(self):
        draft = self.edit(
            {"branding": {"logo_url": "http://localhost:8080/media/logo.png"}}
        )
        self.assertEqual(
            draft.draft["header"]["logo_url"], draft.draft["branding"]["logo_url"]
        )
        draft = self.edit({"branding": {"logo_url": ""}})
        self.assertEqual(draft.draft["header"]["logo_url"], "")
        draft = self.edit({"header": {"logo_url": "/media/legacy.png"}})
        self.assertEqual(draft.draft["branding"]["logo_url"], "/media/legacy.png")

    def test_an_explicit_seo_title_equal_to_the_seed_is_not_overridden(self):
        self.edit({"general": {"site_name": "New brand"}})
        self.edit({"seo": {"title": "Original title"}})
        self.publish()
        self.assertEqual(self.payload()["data"]["seo"]["title"], "Original title")
        self.edit({"general": {"site_name": "Another new brand"}})
        self.publish()
        self.assertEqual(self.payload()["data"]["seo"]["title"], "Original title")

    def test_cleared_text_and_collection_edits_are_in_the_delivery_payload(self):
        self.edit(
            {"hero": {"subheading": "", "buttons": []}, "navigation": {"items": []}}
        )
        self.publish()
        data = self.payload()["data"]
        self.assertEqual(data["hero"]["subheading"], "")
        self.assertEqual(data["navigation"]["items"], [])
        self.assertIn("hero.subheading", data["overrides"])
        self.assertIn("hero.buttons", data["overrides"])

    def test_local_upload_urls_are_portable_but_external_assets_are_unchanged(self):
        self.edit(
            {"branding": {"favicon_url": "http://localhost:8080/media/favicon.png"}}
        )
        self.publish()
        self.assertEqual(self.payload()["data"]["favicon_url"], "/media/favicon.png")
        external = "https://cdn.example.com/media/image.png"
        self.assertEqual(delivery_media_url(external), external)
        self.assertEqual(
            delivery_media_url("http://[::1]:8080/media/logo.png"), "/media/logo.png"
        )

    def test_rollback_republishes_the_requested_immutable_version(self):
        first = self.publish()
        self.edit({"hero": {"heading": "Second version"}})
        second = self.publish()
        with self.captureOnCommitCallbacks(execute=True):
            services.rollback(actor=None, site=self.site, version_id=first.pk)
        self.assertEqual(
            self.payload()["data"]["hero"]["heading"], first.snapshot["hero"]["heading"]
        )
        second.refresh_from_db()
        self.assertEqual(second.status, "archived")

    def test_migration_preserves_custom_selectors_and_disabled_choices(self):
        custom = self.site.mappings.create(key="site_logo", selector=".my-logo")
        legacy = self.site.mappings.create(
            key="hero_subheading", selector=".hero p", enabled=False
        )
        migration = import_module(
            "apps.connector.migrations.0002_connector_fields_and_defaults"
        )
        migration.upgrade_defaults(apps, None)
        custom.refresh_from_db()
        legacy.refresh_from_db()
        self.assertEqual(custom.selector, ".my-logo")
        self.assertEqual(legacy.selector, DEFAULT_SELECTORS["hero_subheading"])
        self.assertFalse(legacy.enabled)
        self.assertEqual(self.site.mappings.count(), len(DEFAULT_SELECTORS))
        self.assertEqual(migration.DEFAULTS, DEFAULT_SELECTORS)

    def test_new_defaults_are_present_on_the_first_prefetched_payload(self):
        self.publish()
        payload = build_payload(public_site(self.site.site_key))
        self.assertEqual(len(payload["mappings"]), len(DEFAULT_SELECTORS))

    def authenticated_client(self):
        user = get_user_model().objects.create_user(
            username="publish-regression-owner", role="superadmin"
        )
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_editor_patch_save_publish_and_public_delivery_endpoint_flow(self):
        client = self.authenticated_client()
        base = f"/api/v1/sites/{self.site.pk}/config/"
        self.assertEqual(
            client.patch(
                base, {"hero": {"heading": "Earlier"}}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(client.post(base + "save-draft/", {}).status_code, 201)
        self.assertEqual(
            client.patch(
                base, {"hero": {"heading": "Latest"}}, format="json"
            ).status_code,
            200,
        )
        with self.captureOnCommitCallbacks(execute=True):
            response = client.post(base + "publish/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["snapshot"]["hero"]["heading"], "Latest")
        public = self.client.get(f"/connector/v1/config/{self.site.site_key}/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.json()["data"]["hero"]["heading"], "Latest")
        self.assertEqual(public["Access-Control-Allow-Origin"], "*")

    def test_mapping_patch_is_visible_on_the_very_next_public_request(self):
        self.publish()
        endpoint = f"/connector/v1/config/{self.site.site_key}/"
        before = self.client.get(endpoint)
        mapping = self.site.mappings.get(key="hero_heading")
        client = self.authenticated_client()
        with self.captureOnCommitCallbacks(execute=True):
            response = client.patch(
                f"/api/v1/sites/{self.site.pk}/mappings/{mapping.pk}/",
                {"selector": ".immediately-updated"},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        after = self.client.get(endpoint)
        self.assertNotEqual(before["ETag"], after["ETag"])
        self.assertIn(
            {"key": "hero_heading", "selector": ".immediately-updated"},
            after.json()["mappings"],
        )

    def test_loader_revalidates_instead_of_remaining_cached_for_an_hour(self):
        response = self.client.get("/connector/v1/loader.js?site=example")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Cache-Control"], "public, max-age=0, must-revalidate"
        )
        self.assertIn(b"__CMS_CONNECTOR__", response.content)
