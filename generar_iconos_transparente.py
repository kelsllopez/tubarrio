# generar_iconos_transparente.py
import os

# Primero intentamos instalar Pillow si no está
try:
    from PIL import Image
except ImportError:
    print("📦 Instalando Pillow...")
    os.system("pip install Pillow")
    from PIL import Image

def generar_iconos_con_transparencia():
    # Crear carpeta icons
    icons_path = 'static/icons'
    os.makedirs(icons_path, exist_ok=True)
    
    # Cargar tu logo original
    logo = Image.open('static/img/logo.png')
    
    # Convertir a RGBA para mantener transparencia
    if logo.mode != 'RGBA':
        logo = logo.convert('RGBA')
    
    # Tamaños necesarios
    sizes = [192, 512]
    
    for size in sizes:
        # Crear una nueva imagen con fondo TRANSPARENTE
        nueva_imagen = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        
        # Calcular tamaño manteniendo proporción
        logo_ratio = logo.width / logo.height
        if logo_ratio > 1:
            # Logo más ancho que alto
            new_width = int(size * 0.8)  # 80% del tamaño para márgenes
            new_height = int(new_width / logo_ratio)
        else:
            # Logo más alto que ancho
            new_height = int(size * 0.8)
            new_width = int(new_height * logo_ratio)
        
        # Redimensionar logo con alta calidad
        logo_redimensionado = logo.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Centrar en el canvas
        x = (size - new_width) // 2
        y = (size - new_height) // 2
        
        # Pegar logo manteniendo transparencia
        nueva_imagen.paste(logo_redimensionado, (x, y), logo_redimensionado)
        
        # Guardar
        output_path = f'{icons_path}/icon-{size}.png'
        nueva_imagen.save(output_path, 'PNG', optimize=True)
        print(f'✅ Generado con fondo TRANSPARENTE: {output_path}')
    
    print('\n🎉 ¡Iconos PWA con transparencia listos!')
    print(f'📁 Ubicación: {icons_path}/')

if __name__ == '__main__':
    generar_iconos_con_transparencia()