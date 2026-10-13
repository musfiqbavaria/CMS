"""Beat schedules for monitoring/maintenance tasks (DB-backed, editable in admin)."""

from django.db import migrations


def create_schedules(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    every_5_min, _ = IntervalSchedule.objects.get_or_create(every=5, period="minutes")
    daily_2am, _ = CrontabSchedule.objects.get_or_create(minute="0", hour="2")

    jobs = [
        (
            "uptime check (5 min)",
            "monitoring.check_site_uptime",
            {"interval": every_5_min},
        ),
        (
            "ssl expiry check (daily)",
            "monitoring.check_ssl_expiry",
            {"crontab": daily_2am},
        ),
        (
            "connector presence check (daily)",
            "monitoring.check_connector_presence",
            {"crontab": daily_2am},
        ),
        (
            "sitemap refresh (daily)",
            "monitoring.refresh_all_sitemaps",
            {"crontab": daily_2am},
        ),
        ("database backup (daily)", "monitoring.db_backup", {"crontab": daily_2am}),
        ("retention cleanup (daily)", "monitoring.cleanup_old", {"crontab": daily_2am}),
    ]
    for name, task, schedule in jobs:
        PeriodicTask.objects.get_or_create(
            name=name, defaults={"task": task, **schedule}
        )


def remove_schedules(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(
        name__in=[
            "uptime check (5 min)",
            "ssl expiry check (daily)",
            "connector presence check (daily)",
            "sitemap refresh (daily)",
            "database backup (daily)",
            "retention cleanup (daily)",
        ]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("monitoring", "0001_initial"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [migrations.RunPython(create_schedules, remove_schedules)]
