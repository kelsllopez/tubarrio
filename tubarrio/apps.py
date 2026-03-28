from django.apps import AppConfig


class TubarrioConfig(AppConfig):
    """
    Reemplaza el nombre 'tuapp' con el nombre real de tu app.
    Este archivo activa las señales (signals.py) al arrancar Django.
    """
    default_auto_field = "django.db.models.BigAutoField"
    name = "tubarrio"  # ← cambia esto al nombre de tu app

    def ready(self):
        import tubarrio.signals  # ← cambia "tuapp" al nombre de tu app