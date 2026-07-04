#!/usr/bin/python
# -*- coding: utf-8 -*-

#////////////////////////////////////////////////////////////////////////////////////
#//   AUTOR: ADRIÁN SAN JOSÉ TORICES                                   Febrero/2022
#////////////////////////////////////////////////////////////////////////////////////
#//   PROGRAMA: OLED - MCP 3304                     VERSIÓN: 1.0      
#//   DISPOSITIVO: Broadcom BCM2837B0, Cortex-A53 (ARMv8) 64-bit SoC                              
#//   Versión Python:   3.9.2                             
#//   TARJETA DE APLICACIÓN: Raspberry Pi 4                   
#////////////////////////////////////////////////////////////////////////////////////
#                              EXPLICACIÓN DEL PROGRAMA
#////////////////////////////////////////////////////////////////////////////////////
#
# Realiza la medida de los 8 canales mediante el MCP3304, siendo visualizados en la
# pantalla OLED. En caso de que el valor de referencia sea sobrepasado, aparecerá 
# un mensaje en indicando que el valor de referencia ha sido sobrepasado.

#////////////////////////////////////////////////////////////////////////////////////
# IMPORTAR LIBRERÍAS E INSTANCIAR CLASES
#////////////////////////////////////////////////////////////////////////////////////

from gpiozero import MCP3304
from time import sleep

import Adafruit_SSD1306

from PIL import Image
from PIL import ImageDraw
from PIL import ImageFont

#////////////////////////////////////////////////////////////////////////////////////
# VARIABLES GLOBALES
#////////////////////////////////////////////////////////////////////////////////////

Valor_de_referencia = 5.215

RST = None # Numero de pin donde esta conectado el pin RESET de la pantalla oled
Mensaje_OLED = ""

#////////////////////////////////////////////////////////////////////////////////////
# CONFIGURACIÓN PUERTOS GPIO Y RECURSOS A UTILIZAR
#////////////////////////////////////////////////////////////////////////////////////

# Creamos el objeto controlador
oled = Adafruit_SSD1306.SSD1306_128_64(rst = RST)


# Definimos altura y anchura de la pantalla
anchura = oled.width
altura = oled.height

# Creamos un objeto imagen sobre el cual vamos a dibujar usando PIL
image = Image.new('1', (anchura,altura))

draw = ImageDraw.Draw(image)

# Inicializamos la pantalla
oled.begin()
# Limpiamos la pantalla
oled.clear()
#.display es la funcion que mostrara los cambios a la pantalla
oled.display()

font = ImageFont.truetype('/usr/share/fonts/truetype/crosextra/Carlito-BoldItalic.ttf', 10)

#////////////////////////////////////////////////////////////////////////////////////
# FUNCIONES
#////////////////////////////////////////////////////////////////////////////////////

#////////////////////////////////////////////////////////////////////////////////////
# PROGRAMA PRINCIPAL
#////////////////////////////////////////////////////////////////////////////////////
try:
    
    # Iniciamos un loop infinito
    while True:

        # Borrar informacion de la pantalla OLED
        oled.clear()
        draw.rectangle((0,0,anchura,altura), outline = 0, fill = 0) # fill = 0, LEDs apagados.
        oled.display()

        #============================================================================
        # LECTURA DE LOS 8 CANALES DEL MCP3304
        #============================================================================

        for x in range(0, 8):
    
            Medidas = 0

            # Realiza 5 medidas del mismo canal.
            for y in range(0, 5):

                adc = MCP3304(channel=x, device=0)
                Medidas += adc.value

                sleep(0.1)
            
            #========================================================================
            # MUESTRA LA INFORMACIÓN EN LA OLED
            #========================================================================

            # Comprobar si el valor medido es mayor que el valor de referencia.
            # Cuando el valor de referencia es sobrepasado, la lectura es 1.0. 5 Medidas 5.0.
            if Medidas == 5.0:

                # Borrar informacion de la pantalla OLED.
                oled.clear()
                draw.rectangle((0, 0, anchura, altura), outline = 0, fill = 0)
                oled.display()
                
                # Cambiar el tamaño de letra.
                font = ImageFont.truetype('/usr/share/fonts/truetype/crosextra/Carlito-BoldItalic.ttf', 16)
                
                Mensaje_OLED += "Canal "
                Mensaje_OLED += str(x)
                Mensaje_OLED += ": "

                draw.text((35,10), Mensaje_OLED, font = font, fill = 255) # fill = 255, LEDs encendidos.
                draw.text((0,32), "Valor de referencia sobrepasado", font = font, fill = 255)
                draw.text((25, 32+18), "sobrepasado", font = font, fill = 255)
                oled.image(image)
                oled.display()

                sleep(1)

                # Borrar informacion de la pantalla OLED.
                oled.clear()
                draw.rectangle((0,0,anchura,altura), outline = 0, fill = 0)
                oled.display()

                Mensaje_OLED = ""
                # Tiempo de espera para visualizar el ultimo valor.
                if x == 7:
                    sleep(1)

                #print("Canal",x,":","Valor de referencia sobrepasado")

            else:

                VoltajeMedio = round(Valor_de_referencia * (Medidas / 5), 2)
                #print("Canal",x,":", VoltajeMedio,"V")

                Mensaje_OLED += "Canal "
                Mensaje_OLED += str(x)
                Mensaje_OLED += ": "
                Mensaje_OLED += str(VoltajeMedio)
                Mensaje_OLED += "V"
                
                # Cambiar el tamaño de letra.
                font = ImageFont.truetype('/usr/share/fonts/truetype/crosextra/Carlito-BoldItalic.ttf', 10)
                
                # Distribución de los valores en la pantalla OLED (2 columnas y 4 filas)
                if x < 4:
                    
                    #print("Canal",x,":", VoltajeMedio,"V")
                    draw.text((0,x*9), Mensaje_OLED, font = font, fill = 255)
                    oled.image(image)
                    oled.display()
                
                elif x > 3:
                    
                    draw.text((64,9*(x-4)), Mensaje_OLED, font = font, fill = 255)
                    oled.image(image)
                    oled.display()
                    
                    # Tiempo de espera para visualizar el ultimo valor.
                    if x == 7:
                        sleep(1)
 
                Mensaje_OLED = ""
            
            sleep(0.05)
        


except KeyboardInterrupt:         #Si el usuario pulsa CONTROL+C entonces...
    print("El usuario ha pulsado Ctrl+C...")
except:
    print("error inesperado")
finally:
    """
    CERRAMOS RECURSOS ABIERTOS
    """

