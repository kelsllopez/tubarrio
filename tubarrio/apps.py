from django.apps import AppConfig


class TubarrioConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "tubarrio" 

    def ready(self):
        import tubarrio.signals 