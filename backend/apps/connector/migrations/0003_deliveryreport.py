import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("connector", "0002_connector_fields_and_defaults")]
    operations = [
        migrations.CreateModel(
            name="DeliveryReport",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("attempt_id", models.UUIDField(unique=True)),
                ("version_no", models.PositiveIntegerField(blank=True, null=True)),
                ("revision", models.CharField(blank=True, default="", max_length=64)),
                ("state", models.CharField(max_length=16)),
                ("context", models.CharField(max_length=16)),
                ("page_path", models.CharField(default="/", max_length=256)),
                ("applied", models.JSONField(default=list)),
                ("unmatched", models.JSONField(default=list)),
                ("errors", models.JSONField(default=list)),
                ("started_at", models.DateTimeField()),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                (
                    "site",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="delivery_reports",
                        to="sites.site",
                    ),
                ),
            ],
            options={
                "ordering": ["-started_at", "-received_at", "-id"],
                "indexes": [
                    models.Index(
                        fields=["site", "context", "-started_at"],
                        name="delivery_site_context_idx",
                    )
                ],
            },
        ),
    ]
