# Manual del Programador - TuBarrio

## Estructura de Base de Datos

![Diagrama de modelos](diagrama_modelos.png)

## Modelos principales

### Negocio
- nombre: CharField
- tipo: CharField (Emprendimiento/Belleza/Comida)
- estado: CharField (pendiente/aprobado/rechazado)
...

## Instalación
1. Clonar repositorio
2. Crear venv: `python -m venv venv`
3. Activar: `venv\Scripts\activate`
4. Instalar: `pip install -r requirements.txt`
5. Migrar: `python manage.py migrate`
6. Crear superuser: `python manage.py createsuperuser`