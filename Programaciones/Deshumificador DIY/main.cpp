/*
////////////////////////////////////////////////////////////////////////////////////
//   AUTOR: Adrián San José Torices                                 Diciembre/2025
////////////////////////////////////////////////////////////////////////////////////
//   PROGRAMA: Deshumidificador DIY                    VERSIÓN:       1.0
//   DISPOSITIVO: ESP32                                COMPILADOR:    AVR
//   Entorno IDE: Platform IO + VSC                    SIMULADOR:     
//   TARJETA DE APLICACIÓN: WEMOS ESP32 D1 MINI        DEBUGGER:     
////////////////////////////////////////////////////////////////////////////////////
                            DESHUMIDIFICADOR DIY
////////////////////////////////////////////////////////////////////////////////////
*/
////////////////////////////////////////////////////////////////////////////////////
// LIBRERÍAS ///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

#include <Arduino.h>                // Funciones básicas de Arduino.
#include <lvgl.h>                   // Motor gráfico para crear interfaces visuales.
#include <TFT_eSPI.h>               // Controlador de pantalla TFT compatible con ESP32.
#include <XPT2046_Touchscreen.h>    // Controlador para el táctil de la pantalla TFT XPT2046.
#include <SPI.h>                    // Comunicación SPI para la pantalla y el táctil.
#include <EEPROM.h>                 // Permite leer y escribir en la memoria no volátill del ESP32.
#include <vars.h>                   // Archivo de cabecera con variables compartidas
                                    // entre tareas y funciones.  
#include "ui.h"                     // Archivo de interfaz generado por EZZ Studio.
                                    // que vincula los elementos gráficos con las 
                                    // variables y funciones del código.
#include <SensirionI2cSht4x.h>      // Lectura y comunicación son el sensor SHT45.
#include <Wire.h>                   // Comunicación I2C para el sensor SHT45.
#include <string>                   // Biblioteca estándar de C++ para manipulación 
                                    // forma más avanzada, las cadenas de texto.


////////////////////////////////////////////////////////////////////////////////////
// VARIABLES GLOBALES //////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

//==================================================================================
// ENTRADAS
//==================================================================================

constexpr int TOUCH_IRQ_PIN = 35;  // -1 si no se usa IRQ
constexpr uint8_t S_Llenado = 12;  // Sensor nivel depósito

//==================================================================================
// SALIDAS
//==================================================================================

constexpr int TOUCH_CS_PIN  = 33;

constexpr uint8_t Buzzer  = 2;     // NO usar 34–39
constexpr uint8_t Ventilador = 32;
constexpr uint8_t Compresor = 27;

//==================================================================================
// MARCAS
//==================================================================================

// --- Dimensiones de la pantalla TFT ---
#define TFT_WIDTH  320
#define TFT_HEIGHT 240

// --- Parámetros del Buzzer ---
constexpr uint8_t BUZZER_CH   = 0;     // Canal libre (0–15)
constexpr uint8_t BUZZER_RES  = 8;     // Resolución
constexpr uint8_t BUZZER_DUTY = 128;   // 50%

// --- Lecturas y umbrales de senores---
float Temperatura = 0.0;
float Temperatura_TFT = 0.0;
float Humedad = 0.0;
int8_t Humedad_TFT = 0;
int8_t Humedad_umbral = 50;

// --- Control de tiempos y temporizadores ---
float Tiempo_limite = 8.0;            // Tiempo límite en número decimal.
unsigned long Tiempo_limite_ms = 0;
String Cuenta_atras = "";
bool Temporizador_0 = 0;
bool Switch_Temporizador = 0;
bool Last_Switch_Temporizador = 0;
float Last_Tiempo_limite = 0;

// --- Variables de estado y control del sistema ---
bool Funcionando = 0;
bool Modo_Continuo = 0;
bool Deposito = 0;
uint8_t Alarma = 1;
bool Arranque_compresor = 0;

// --- Variables de desescarchado ---
bool Desescarchando = 0;                    // Estado de desescarchado.
float Temperatura_Hielo = 16.0;             // Temperatura a la que se considera que 
                                            // hay riesgo de hielo en el evaporador.
float Temperatura_Hielo_Critico = 12.0;     // Temperatura crítica para riesgo de hielo
                                            //  en el evaporador.
uint8_t Tiempo_Desescarchado = 8;           // Tiempo de desescarchado en minutos.
uint8_t Tiempo_Desescarchado_Critico = 15;  // Tiempo de desescarchado largo en minutos.

// --- Análisis y buffers de control ---
float buffer_temperaturas[60];
int indice_buffer = 0;
bool buffer_lleno = false;


//==================================================================================
// CONFIGURACIÓN DE PANTALLA Y GRÁFICOS
//==================================================================================

// --- Buffers de Renderizado de LVGL ---
static const int BUF_LINES = 40;              // Número de líneas del buffer de LVGL
static lv_color_t buf[BUF_LINES * TFT_WIDTH]; // Buffer de LVGL
static lv_disp_draw_buf_t draw_buf;           // Descriptor del buffer de LVGL

// --- Parametros de calibración del táctil ---
struct Calib { float A,B,C,D,E,F; uint32_t magic; };
Calib calib;
#define CAL_MAGIC 0x12345678

// --- Puntos de referencia para calibración del táctil ---
struct P { int x,y; };
P screenPts[4] = {
  {20,20}, {TFT_WIDTH-20,20}, {TFT_WIDTH-20,TFT_HEIGHT-20}, {20,TFT_HEIGHT-20}
};


////////////////////////////////////////////////////////////////////////////////////
// VARIABLES DE CONTROL DEL SISTEMA (RTOS) /////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

//==================================================================================
// MUTEX DE SEGURIDAD
//==================================================================================
SemaphoreHandle_t mutexTempHum;                  // Mutex para proteger la humedad y temperatura.
SemaphoreHandle_t mutexEEPROM;                   // Mutex para proteger la memoria EEPROM.
SemaphoreHandle_t mutexLVGL;                     // Mutex para proteger las variables LVGL.

//==================================================================================
// MANEJADORES (HANDLES) DE LAS TAREAS
//==================================================================================
TaskHandle_t xTaskFuncionamientoHandle = NULL;
TaskHandle_t xTaskDesescarchadoHandle = NULL;
TaskHandle_t xTaskAnalisisHandle = NULL;
TaskHandle_t xTaskLogoHandle = NULL;


////////////////////////////////////////////////////////////////////////////////////
// INSTANCIAR OBJETOS //////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

// --- TFT y Touch ---
TFT_eSPI tft = TFT_eSPI();
XPT2046_Touchscreen touch(TOUCH_CS_PIN, TOUCH_IRQ_PIN);

// --- Sensor SHT45 ---
SensirionI2cSht4x sht4x;


////////////////////////////////////////////////////////////////////////////////////
// FUNCIONES ///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

//==================================================================================
// LEER CALIBRACIÓN DE LA EEPROM
//==================================================================================
bool loadCalibration() {
  //EEPROM.begin(sizeof(Calib)+4);
  EEPROM.get(0, calib);               // Leer datos de la EEPROM.
  //EEPROM.end();
  return (calib.magic == CAL_MAGIC);  // Validación de la integridad de los datos.
}

//==================================================================================
// GUARDAR CALIBRACIÓN EN LA EEPROM
//==================================================================================
void saveCalibration() {
  calib.magic = CAL_MAGIC;    // Codigo para verificar la integridad de los datos de 
                              // calibración.
  //EEPROM.begin(sizeof(Calib)+4);
  EEPROM.put(0, calib);       // Escritura en el buffer.
  EEPROM.commit();            // Guardar en la EEPROM (tarda unos 100ms).
  EEPROM.end();               // Liberar recursos de la EEPROM.
}

//==================================================================================
// LEER RAW ESTABLE DEL TOUCH
//==================================================================================
P readRawPoint() {

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // CONFIGURACIÓN DE LA LECTURA: PROMEDIAR MUESTRAS PARA OBTENER UN VALOR ESTABLE
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  long sx=0, sy=0;
  const int samples=15;   // Número de muestras a promediar.
  int cnt=0;

  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // MUESTREO DE PUNTOS TÁCTILES
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  while(cnt<samples){
    if(touch.touched()){
      TS_Point p = touch.getPoint();
      sx += p.x;                        // Suma valores X.
      sy += p.y;                        // Suma valores Y.
      cnt++;
    }

    delay(5);                           // Estabilizar lectura entre muestras.
  }

  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // CÁLCULO DE LA MEDIA Y RETORNO
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  P r;
  r.x = sx/samples;
  r.y = sy/samples;

  return r;
}

//==================================================================================
// CALIBRACIÓN AUTOMATICA DE 4 PUNTOS
//==================================================================================
void calibrate() {

  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // CONFIGURACIÓN INICIAL DE LA PANTALLA PARA CALIBRACIÓN
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(2);
  tft.setCursor(20, TFT_HEIGHT-30);
  tft.println("Toque los 4 puntos rojos");

  P rawPts[4];
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // PROCESO DE CALIBRACIÓN: MOSTRAR PUNTOS Y LEER COORDENADAS RAW
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  for(int i=0;i<4;i++){

    // --- Dibujar el punto de calibración en la pantalla TFT ---
    tft.fillCircle(screenPts[i].x, screenPts[i].y, 8, ILI9341_RED);
    
    // --- Esperar a que el usuario toque el punto de calibración ---
    while(!touch.touched()) delay(10);
    delay(200);                           // Estabilizar lectura.

    rawPts[i] = readRawPoint();

    // --- Marcar el punto como calibrado en la pantalla TFT ---
    tft.fillCircle(screenPts[i].x, screenPts[i].y, 8, ILI9341_GREEN);
    delay(400);

    // --- Esperar a que el usuario suelte el punto de calibración ---
    while(touch.touched()) delay(10);
  }

  // Calcular coeficientes lineales (simple)
  calib.A = (float)(screenPts[1].x - screenPts[0].x)/(rawPts[1].x - rawPts[0].x);
  calib.B = 0; // sin skew
  calib.C = screenPts[0].x - calib.A * rawPts[0].x;

  calib.D = 0;
  calib.E = (float)(screenPts[3].y - screenPts[0].y)/(rawPts[3].y - rawPts[0].y);
  calib.F = screenPts[0].y - calib.E * rawPts[0].y;

  saveCalibration();
  tft.fillScreen(TFT_BLACK);
  tft.setCursor(60,TFT_HEIGHT/2);
  tft.println("CALIBRADO!");
  delay(800);
}

//==================================================================================
// LVGL TOUCH CALLBACK
//==================================================================================
void my_touchpad_read(lv_indev_drv_t * drv, lv_indev_data_t* data) {

  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // ESTADO INICIAL DE LVGL (SIN TOQUE)
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  data->state = LV_INDEV_STATE_REL;

  if(!touch.touched()) return;

  TS_Point p = touch.getPoint();
  if(p.z <= 0) return;

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // APLICAR CALIBRACIÓN A LAS COORDENADAS RAW DEL TOUCH
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  int tx = calib.A * p.x + calib.B * p.y + calib.C;
  int ty = calib.D * p.x + calib.E * p.y + calib.F;

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // AJUSTAR LOS LÍMITES DE LAS COORDENADAS CALIBRADAS (CLAMP)
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  if(tx<0) tx=0;
  if(tx>TFT_WIDTH-1) tx=TFT_WIDTH-1;
  if(ty<0) ty=0;
  if(ty>TFT_HEIGHT-1) ty=TFT_HEIGHT-1;

  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // ACTUALIZACIÓN DE DATOS LVGL
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  data->state = LV_INDEV_STATE_PR;
  data->point.x = tx;
  data->point.y = ty;
}

//==================================================================================
// LVGL DISPLAY FLUSH
//==================================================================================
void my_disp_flush(lv_disp_drv_t *disp_drv, const lv_area_t *area, lv_color_t *color_p) {

  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // CALCULAR ANCHO Y ALTO DEL ÁREA A ACTUALIZAR
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  uint32_t w = area->x2 - area->x1 + 1;
  uint32_t h = area->y2 - area->y1 + 1;

  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // ESCRIBIR LOS PIXELES EN LA PANTALLA TFT
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  tft.startWrite();                               // Iniciar escritura en la pantalla TFT
  tft.setAddrWindow(area->x1, area->y1, w, h);    // Establecer la ventana de 
                                                  // actualización en la pantalla TFT.
  tft.pushColors((uint16_t*)color_p, w*h, true);  // Enviar los colores al área 
                                                  // especificada en la pantalla TFT
  tft.endWrite();                                 // Finalizar escritura en la pantalla TFT
  lv_disp_flush_ready(disp_drv);                  // Informar a LVGL que se ha completado
                                                  // la actualización del área en la pantalla TFT
}

static unsigned long lv_last_tick = 0;

//===============================================================================
// TASK LECTURA TEMPERATURA Y HUMEDAD
//===============================================================================
void TaskSHT45(void *pvParameters) {
  while (true) {

    float sumaTemp = 0.0;
    float sumaHum = 0.0;
    float T = 0.0;
    float H = 0.0;

    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // LEER TEMPERATURA Y HUMEDAD DEL SENSOR
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    for(int i=0; i<100; i++){

      sht4x.measureHighPrecision(T, H);
      sumaTemp += T;
      sumaHum += H;

      vTaskDelay(10 / portTICK_PERIOD_MS);
        
    }

    float mediaTemp = sumaTemp / 100.0;
    float mediaHum = sumaHum / 100.0;
    
    // --- Bloquear con mutex antes de modificar la variable ---
    if (xSemaphoreTake(mutexTempHum, (TickType_t)10) == pdTRUE) {
      Temperatura = (round(mediaTemp * 10)) / 10.0;
      Humedad = (round(mediaHum * 10)) / 10.0;
      Humedad = round(mediaHum);

      // Libera el mutex después de modificar la variable.
      xSemaphoreGive(mutexTempHum);
    }
    
    //Serial.println(Temperatura);
    //Serial.println(Humedad);

    vTaskDelay(1000 / portTICK_PERIOD_MS);

    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual

  }

}

//===============================================================================
// MOSTRAR TEMPERATURA Y HUMEDAD EN PANTALLA TFT
//===============================================================================
void TaskMostrarTFT(void *pvParameters) {
  while (true) {

    char Valor[15];
    String Texto = "";
    int16_t Arco = 0;

    // ---Bloquear con mutex antes de leer la variable ---
    if (xSemaphoreTake(mutexTempHum, (TickType_t)10) == pdTRUE) {

      //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      // ACTUALIZAR TEMPERATURA EN PANTALLA TFT
      //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      if (Temperatura != Temperatura_TFT) {

        Texto = String(Temperatura, 1) + "°C";
        Texto.replace(".", ",");

        Arco = Temperatura * 10;
        Arco = constrain(Arco, 0, 450);
          
        Texto.toCharArray(Valor, sizeof(Valor));
        
        // --- Actualizar temperatura en pantalla TFT ---
        if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(20)) == pdTRUE) {
          set_var_temperatura_tft(Valor);
          set_var_temperatura_arc(Arco);
          xSemaphoreGive(mutexLVGL);
        }

        Temperatura_TFT = Temperatura;

      }

      //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      // ACTUALIZAR HUMEDAD EN PANTALLA TFT
      //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      if (Humedad != Humedad_TFT) {

        Texto = String(Humedad, 0) + "%";
        Arco = round(Humedad);

        Texto.toCharArray(Valor, sizeof(Valor));

        // --- Actualizar humedad en pantalla TFT ---
        if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(20)) == pdTRUE) {
          set_var_humedad_tft(Valor);
          set_var_humedad_arc(Arco);
          xSemaphoreGive(mutexLVGL);
        }

        Humedad_TFT = Humedad;

      }

      // Liberamos el mutex después de modificar la variable
      xSemaphoreGive(mutexTempHum);
    }

    vTaskDelay(1000 / portTICK_PERIOD_MS);

    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual

  }
}

//===============================================================================
// TASK TACTIL Y LVGL
//===============================================================================
void TaskTactilLVGL(void *pvParameters) {
  while (true) {

    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // SINCRONIZACIÓN DE TIEMPO PARA LVGL
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    unsigned long now = millis();
    uint32_t diff = now - lv_last_tick;
    if(diff){
      lv_tick_inc(diff);
      lv_last_tick = now;
    }
    
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // PROCESAMIENTO DE LA INTERFAZ LVGL Y LECTURA DE ENTRADAS TÁCTILES
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // Ejecutamos las tareas pendientes de LVGL y lectura de eventos.
    if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
      lv_timer_handler();
      ui_tick();
      xSemaphoreGive(mutexLVGL);
    }

    vTaskDelay(5 / portTICK_PERIOD_MS);
    
    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual

  }
}

//===============================================================================
// TASK SENSOR DE LLENADO DEPÓSITO
//===============================================================================
void TaskDeposito(void *pvParameters) {

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // VARIABLES DEL TASK
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  bool Deposito_lleno = 0;
  bool Deposito_vacio = 0;

  while (true) {

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // LECTURA DEL SENSOR DE LLENADO DEL DEPÓSITO
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    Deposito = digitalRead(S_Llenado);

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // DEPOSITO LLENO O EXTRAIDO
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (Deposito == 1 && Deposito_lleno == 0) {

      Deposito_lleno = 1;
      Deposito_vacio = 0;
      
      // --- Suspender task funcionamiento ---
      if (xTaskFuncionamientoHandle != NULL) {
        vTaskSuspend(xTaskFuncionamientoHandle);
      }
      
      // --- Apagar compresor, ventilador y resetear variables ---
      digitalWrite(Compresor, 0);
      digitalWrite(Ventilador, 0);

      Funcionando = 0;
      Arranque_compresor = 0;

      //Serial.println("Deposito lleno");

      // --- Mostrar mensaje de depósito lleno en la pantalla TFT ---
      if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        set_var_mensaje_deposito_lleno(Deposito);
        xSemaphoreGive(mutexLVGL);
      }
      
      // --- Activar alarma sonora ---
      if (Alarma == 1){

        for(int i=0; i<4; i++){

          ledcWrite(BUZZER_CH, BUZZER_DUTY);
          vTaskDelay(500 / portTICK_PERIOD_MS);
          ledcWrite(BUZZER_CH, 0);
          vTaskDelay(500 / portTICK_PERIOD_MS);

        }
      }
    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // DEPOSITO VACÍO O INTRODUCIDO
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    else if (Deposito == 0 && Deposito_vacio == 0) {

      Deposito_vacio = 1;
      Deposito_lleno = 0;

      // --- Reanudar task funcionamiento ---
      if (xTaskFuncionamientoHandle != NULL) {
        vTaskResume(xTaskFuncionamientoHandle);
      }

      // --- Modo desescarchado se mantiene funcionando ---
      if (Desescarchando == 1) {

        digitalWrite(Ventilador, 1);
      }

      //Serial.println("Deposito vacio");
      
      // --- Ocultar mensaje de depósito lleno en la pantalla TFT ---
      if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        set_var_mensaje_deposito_lleno(Deposito);
        xSemaphoreGive(mutexLVGL);
      }

    }
        
    vTaskDelay(500 / portTICK_PERIOD_MS);
    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual

  }

}

//===============================================================================
// TASK FUNCIONAMIENTO
//===============================================================================
void TaskFuncionamiento(void *pvParameters) {
  
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // VARIABLES DEL TASK
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  bool Parado = 0;
  unsigned long Tiempo_arranque = 0;
  
  while (true) {    

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // LÓGICA DE CONTROL DE FUNCIONAMIENTO
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if ((Humedad >= (Humedad_umbral + 5) || Modo_Continuo == 1) && Funcionando == 0 && Deposito == 0 && Desescarchando == 0) {
      
      Funcionando = 1;
      Parado = 0;
      //Serial.println("Ventilador");
      digitalWrite(Ventilador, 1);

      Tiempo_arranque = millis();   // Momento en el que guardamos el tiempo actual
                                    // para encender el compresor posteriormente.
      
      Arranque_compresor = 1;       // Indicamos que estamos en el proceso de arranque,
                                    // para que la lógica posterior se encargue de 
                                    // encender el compresor tras los 30 segundos.

      //Serial.println("Funcionando");
      
    }
    
    else if (Humedad < Humedad_umbral && Parado == 0 && Modo_Continuo == 0) {
      
      Parado = 1;
      Funcionando = 0;
      Arranque_compresor = 0;

      digitalWrite(Compresor, 0);
      digitalWrite(Ventilador, 0);
      //Serial.println("Parado");

    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ARRANQUE DEL COMPRESOR CON RETRASO DE 30 SEGUNDOS
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (Arranque_compresor == 1) {

      // Si han pasado 30 segundos...
      if (millis() - Tiempo_arranque >= 30000) {

        if (!Deposito && !Temporizador_0) { // Doble check de seguridad

          digitalWrite(Compresor, 1);

        }

        Arranque_compresor = 0; // Ya no estamos esperando, ya arrancó
      }
    }

    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual
    vTaskDelay(500 / portTICK_PERIOD_MS);
  }
}

//===============================================================================
// TASK CONFIGURACIÓN HUMEDAD
//===============================================================================
void TaskConfiguracionHumedad(void *pvParameters) {
  while (true) {

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // LECTURA BOTONES AJUSTE HUMEDAD UMBRAL
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    bool Mas_Humedad = 0;
    bool Menos_Humedad = 0;

    if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
      Mas_Humedad = get_var_mas_humedad();
      Menos_Humedad = get_var_menos_humedad();
      xSemaphoreGive(mutexLVGL);
    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // MODIFICAR HUMEDAD UMBRAL
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    static bool Last_Mas_Humedad = 0;
    static bool Last_Menos_Humedad = 0;

    if (Mas_Humedad == 1 & Last_Mas_Humedad == 0) {

      Humedad_umbral += 5;
      Humedad_umbral = constrain(Humedad_umbral, 0, 100);
      
    }

    if (Menos_Humedad == 1 & Last_Menos_Humedad == 0) {

      Humedad_umbral -= 5;
      Humedad_umbral = constrain(Humedad_umbral, 0, 100);
      
    }

    Last_Mas_Humedad = Mas_Humedad;
    Last_Menos_Humedad = Menos_Humedad;

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ACTUALIZAR HUMEDAD UMBRAL PANTALLA TFT Y EEPROM
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    char Valor[20];
    String Texto = "";

    static int8_t Last_Humedad_umbral;

    if (Humedad_umbral != Last_Humedad_umbral) {

      Texto = String(Humedad_umbral) + "%";
  
      Texto.toCharArray(Valor, sizeof(Valor));
      set_var_hum_limite(Valor);
      
      // --- Guardar valores en la  EEPROM ---
      if (xSemaphoreTake(mutexEEPROM, pdMS_TO_TICKS(10)) == pdTRUE) {

        EEPROM.begin(64);
        EEPROM.put(28, Humedad_umbral);
        EEPROM.commit();
        EEPROM.end();

        xSemaphoreGive(mutexEEPROM);
      }
      
      Last_Humedad_umbral = Humedad_umbral;

    }

    vTaskDelay(50 / portTICK_PERIOD_MS);
    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual

  }
}

//===============================================================================
// TASK CONFIGURACIÓN AJUSTE TIEMPO DE FUNCIONAMIENTO
//===============================================================================
void TaskTFuncionamiento(void *pvParameters) {

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // VARIABLES DEL TASK
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  bool Last_Mas_Tiempo = 0;
  bool Last_Menos_Tiempo = 0;

  u_int8_t Horas = 0;
  float Minutos = 0.0;
  char Valor[15];

  String Tiempo_TFT = "";
  String HorasTFT = "";
  String MinutosTFT = "";

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // MOSTRAR TIEMPO DE FUNCIONAMIENTO INICIAL EN PANTALLA TFT
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  Horas = (int) Tiempo_limite;
  Minutos = (Tiempo_limite - Horas) * 10;

  HorasTFT = String(Horas);
    
  if (Horas == 0) {

    HorasTFT = "0";
  }
  
  if (Minutos == 0) {
    MinutosTFT = "00";
  }

  else {

    MinutosTFT = "30";
  }

  Tiempo_TFT = HorasTFT + ":" + MinutosTFT;
  Tiempo_TFT.toCharArray(Valor, sizeof(Valor));

  // --- Mostramos el tiempo límite inicial en la pantalla TFT ---
  if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
    set_var_tiempo_limite(Valor);
    xSemaphoreGive(mutexLVGL);
  }

  while (true) {

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // LECTURA BOTONES AJUSTE TIEMPO DE FUNCIONAMENTO
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    bool Mas_Tiempo = 0;
    bool Menos_Tiempo = 0;

    if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
      Mas_Tiempo = get_var_mas_tiempo();
      Menos_Tiempo = get_var_menos_tiempo();
      xSemaphoreGive(mutexLVGL);
    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // MODIFICAR TIEMPO DE FUNCIONAMIENTO
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (Mas_Tiempo == 1 & Last_Mas_Tiempo == 0) {

      Tiempo_limite += 0.5;
      Tiempo_limite = constrain(Tiempo_limite, 0.0, 24.0);
      
    }

    if (Menos_Tiempo == 1 & Last_Menos_Tiempo == 0) {

      Tiempo_limite -= 0.5;
      Tiempo_limite = constrain(Tiempo_limite, 0.0, 24.0);
      
    }

    Last_Mas_Tiempo = Mas_Tiempo;
    Last_Menos_Tiempo = Menos_Tiempo;

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ACTUALIZAR TIEMPO DE FUNCIONAMIENTO EN PANTALLA TFT Y EEPROM
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    String Texto = "";
    
    if (Tiempo_limite != Last_Tiempo_limite | Switch_Temporizador == 1 & Last_Switch_Temporizador == 0) {

      Horas = (int) Tiempo_limite;
      Minutos = (Tiempo_limite - Horas) * 10;

      Tiempo_limite_ms = Horas * 3600000;
      
      HorasTFT = String(Horas);
      
      if (Horas == 0) {

        HorasTFT = "0";
      }
      
      if (Minutos == 0) {
        MinutosTFT = "00";
      }

      else {

        MinutosTFT = "30";
        Tiempo_limite_ms = Tiempo_limite_ms + 30 * 60 * 1000;
      }

      Tiempo_TFT = HorasTFT + ":" + MinutosTFT;
      Tiempo_TFT.toCharArray(Valor, sizeof(Valor));

      // --- Actualizar el tiempo límite en la pantalla TFT ---
      if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        set_var_tiempo_limite(Valor);
        xSemaphoreGive(mutexLVGL);
      }
      
       // --- Guardar el tiempo límite inicial en la EEPROM ---
      if (xSemaphoreTake(mutexEEPROM, pdMS_TO_TICKS(10)) == pdTRUE) {

        EEPROM.begin(128);
        EEPROM.put(32, Tiempo_limite);
        EEPROM.commit();
        EEPROM.end();

        xSemaphoreGive(mutexEEPROM);
      }

      Last_Tiempo_limite = Tiempo_limite;

    }

    Last_Switch_Temporizador = Switch_Temporizador;

    vTaskDelay(50 / portTICK_PERIOD_MS);
    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual

  }
}


//===============================================================================
// TASK CONFIGURACIÓN CUENTA ATRÁS
//===============================================================================
void TaskCuentaAtras(void *pvParameters) {
  while (true) {

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // LECTURA SWITCH TEMPORIZADOR
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
      Switch_Temporizador = get_var_temporizador();
      xSemaphoreGive(mutexLVGL);
    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // MODIFICAR CUENTA ATRÁS Y ACTIVAR TEMPORIZADOR
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    static unsigned long Tiempo_Inicio = 0;
    
    if (Switch_Temporizador == 1 & Last_Switch_Temporizador == 0) {

      Tiempo_Inicio = millis();
      
    }

    else if (Switch_Temporizador == 0 & Last_Switch_Temporizador == 1) {

      // --- Ocultar mensaje de tiempo cumplido en la pantalla TFT ---
      if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        set_var_mensaje_tiempo_cumplido(0);
        xSemaphoreGive(mutexLVGL);
      }

      // --- Reanudar task de funcionamiento ---
      if (xTaskFuncionamientoHandle != NULL) {
        vTaskResume(xTaskFuncionamientoHandle);
      }

      Tiempo_Inicio = 0;   

    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // CALCULAR TIEMPO RESTANTE
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (Switch_Temporizador == 1) {

      static unsigned long Last_Tiempo_Actual = 0;
      static float Last_Tiempo_limite2 = 0;

      unsigned long Tiempo_Actual = millis();

      if (Tiempo_Actual - Last_Tiempo_Actual > 60000 | Last_Switch_Temporizador == 0 | Tiempo_limite != Last_Tiempo_limite2) {

        Last_Tiempo_Actual = Tiempo_Actual;

        unsigned long Tiempo_Transcurrido = Tiempo_Actual - Tiempo_Inicio;
        signed long Tiempo_Restante = Tiempo_limite_ms - Tiempo_Transcurrido;
        Tiempo_Restante = constrain(Tiempo_Restante, 0, 24 * 3600000);

        uint8_t Horas_restantes = int(Tiempo_Restante / 3600000);
        uint8_t Minutos_restantes = int((Tiempo_Restante % 3600000) / 60000);

        String Horas_0 = "";
        String Minutos_0 = "";

        if (Horas_restantes < 10) {
          Horas_0 = "0";
        }

        if (Minutos_restantes < 10) {
          Minutos_0 = "0";
        }
      
        Cuenta_atras = Horas_0 + String(Horas_restantes) + ":" + Minutos_0 + String(Minutos_restantes);
        //Serial.println(Cuenta_atras);

      }

      Last_Tiempo_limite2 = Tiempo_limite;

    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ACTUALIZAR TIEMPO RESTANTE EN PANTALLA TFT
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    static String Last_Cuenta_atras = "";
    char Valor[20];

    if (Switch_Temporizador == 1 & Cuenta_atras != Last_Cuenta_atras | Switch_Temporizador == 1) {

      Cuenta_atras.toCharArray(Valor, sizeof(Valor));

      // --- Actualizar variable en la pantalla TFT ---
      if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        set_var_tiempo(Valor); 
        xSemaphoreGive(mutexLVGL);
      }

      Last_Cuenta_atras = Cuenta_atras;

    }

    vTaskDelay(50 / portTICK_PERIOD_MS);
    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual

  }
}

//===============================================================================
// TASK CUENTA ATRÁS FINALIZADA
//===============================================================================
void TaskCuentaAtrasFin(void *pvParameters) {
  while (true) {

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // TIEMPO DE FUNCIONAMIENTO CUMPLIDO
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (Cuenta_atras == "00:00") {

      //Parado = 1;
      //Temporizador_0 = 1;
      
      Cuenta_atras = "-1";

      // --- Suspender task de funcionamiento ---
      if (xTaskFuncionamientoHandle != NULL) {
        vTaskSuspend(xTaskFuncionamientoHandle);
      }

      // --- Apagar compresor, ventilador y resetear variables ---
      digitalWrite(Compresor, 0);
      digitalWrite(Ventilador, 0);
      
      Arranque_compresor = 0;
      Funcionando = 0;

      // --- Mostrar mensaje en la pantalla TFT ---
      if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        set_var_mensaje_tiempo_cumplido(1);
        xSemaphoreGive(mutexLVGL);
      }
    }


    vTaskDelay(1000 / portTICK_PERIOD_MS);
    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual
  }
}

//===============================================================================
// TASK ALARMA DEPÓSITO LLENO
//===============================================================================
void TaskAlarma(void *pvParameters) {

  // Pequeña espera para asegurar que el sistema ha arrancado.
  vTaskDelay(pdMS_TO_TICKS(1000));

  // --- Sincronización inicial con la interfaz LVGL ---
  if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
    set_var_estado_alarma(Alarma);
    set_var_switch_alarma(Alarma);
    xSemaphoreGive(mutexLVGL);
  }

  while (true) {

    static bool Last_Alarma = 1;

    // --- Monitoreo del estado del switch de alarma ---
    if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
      Alarma = get_var_switch_alarma();
      xSemaphoreGive(mutexLVGL);
    }
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // DETECCIÓN DE CAMBIOS EN EL ESTADO DE LA ALARMA
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (Alarma != Last_Alarma) {

      // Guardar configuración en la EEPROM.
      if (xSemaphoreTake(mutexEEPROM, pdMS_TO_TICKS(10)) == pdTRUE) {

        EEPROM.begin(128);
        EEPROM.put(36, Alarma);
        EEPROM.commit();
        EEPROM.end();

        xSemaphoreGive(mutexEEPROM);
      }

      // Actualizar variable de estado de alarma en la interfaz LVGL.
      if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        set_var_estado_alarma(Alarma);
        xSemaphoreGive(mutexLVGL);
      }

      Last_Alarma = Alarma;

    }
        
    vTaskDelay(50 / portTICK_PERIOD_MS);

    //Serial.println(uxTaskGetStackHighWaterMark(NULL)); // NULL para la tarea actual

  }
}


//===============================================================================
// TASK ANÁLISIS DEL FRÍO
//===============================================================================
void TaskAnalisisFrio(void *pvParameters) {

  // --- Configuración de tiempos ---
  TickType_t xLastWakeTime = xTaskGetTickCount();
  const TickType_t xFrequency = pdMS_TO_TICKS(60000); 
  int minutos_funcionando = 0;

  while (true) {
    vTaskDelayUntil(&xLastWakeTime, xFrequency);
    
    // Si el compresor está OFF, asumimos temperatura ambiente (25.0)
    buffer_temperaturas[indice_buffer] = (digitalRead(Compresor) == HIGH) ? Temperatura : 25.0;
    
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // INDICADORES VISUALES DE RIESGO DE HIELO
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (Temperatura <= Temperatura_Hielo) {
      
      if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        set_var_riesgo_hielo(1);
        xSemaphoreGive(mutexLVGL);
      }

    } else {
      
      if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        set_var_riesgo_hielo(0);
        xSemaphoreGive(mutexLVGL);
      }

    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // GESTIÓN DEL BUFFER CIRCULAR
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    indice_buffer = (indice_buffer + 1) % 60;
    if (minutos_funcionando < 60) minutos_funcionando++;
    //Serial.println(minutos_funcionando);

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ANÁLISIS DE TENDENCIAS
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (minutos_funcionando >= 30) {
      float suma30 = 0;
      int ptr = (indice_buffer - 1 + 60) % 60;
      for(int i = 0; i < 30; i++) suma30 += buffer_temperaturas[(ptr - i + 60) % 60];
      float media30 = suma30 / 30.0;

      bool tipo_desescarchado = 0; // 0: Corto, 1: Largo
      bool activar = false;

      // --- CASO 1: Hielo Crítico (> 11°C en 30 min) -> Tipo 1 (Largo) ---
      if (media30 < Temperatura_Hielo_Critico) {
          tipo_desescarchado = 1; 
          activar = true;
      } 
      // --- CASO 0: Escarcha Leve (12°C - 16°C en 60 min) -> Tipo 0 (Corto) ---
      else if (minutos_funcionando == 60) {
          float suma60 = 0;
          for(int i = 0; i < 60; i++) suma60 += buffer_temperaturas[i];
          float media60 = suma60 / 60.0;
          if (media60 >= Temperatura_Hielo_Critico && media60 <= Temperatura_Hielo) {
              tipo_desescarchado = 0;
              activar = true;
          }
      }
      // --- SI SE CUMPLE ALGÚN CRITERIO, ACTIVAMOS DESESCARCHADO ---
      if (activar && xTaskDesescarchadoHandle != NULL) {
          // Enviamos el bool (0 o 1) como valor de notificación
          xTaskNotify(xTaskDesescarchadoHandle, (uint32_t)tipo_desescarchado, eSetValueWithOverwrite);
          
          // Reset del buffer para empezar ciclo limpio
          minutos_funcionando = 0;
          indice_buffer = 0;
          for(int i = 0; i < 60; i++) buffer_temperaturas[i] = 25.0;
      }
    }
  }
}

//===============================================================================
// TASK DESESCARCHADO
//===============================================================================
void TaskDesescarchado(void *pvParameters) {
  uint32_t modo_recibido = 0;
  
  while (true) {

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ESPERA DE ACTIVACIÓN
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // Espera la notificación de la otra tarea
    xTaskNotifyWait(0x00, 0x00, &modo_recibido, portMAX_DELAY);

    Desescarchando = 1;

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // BLOQUEOD DEL FUNCIONAMIENTO NORMAL
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (xTaskFuncionamientoHandle != NULL) {

      vTaskSuspend(xTaskFuncionamientoHandle);
      vTaskSuspend(xTaskAnalisisHandle);
    }
    
    // --- Apagar compresor --- 
    digitalWrite(Compresor, LOW);
    digitalWrite(Ventilador, HIGH);   // Mantenemos aire para descongelar..
    Funcionando = 0;

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ACTUALIZAR INTERFACE LVGL
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {

      set_var_riesgo_hielo(0);
      set_var_descongelar(1);

      xSemaphoreGive(mutexLVGL);
    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // SELECCIÓN DEL TIEMPO DE DESESCARCHADO SEGÚN EL MODO RECIBIDO
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (modo_recibido == 1) {
        //Serial.println("MODO DESESCARCHE: Largo (15 min) por frío intenso.");
        vTaskDelay(pdMS_TO_TICKS(Tiempo_Desescarchado_Critico*60*1000));
    } else {
        //Serial.println("MODO DESESCARCHE: Corto (8 min) por escarcha leve.");
        vTaskDelay(pdMS_TO_TICKS(Tiempo_Desescarchado*60*1000));
    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ACTUALIZAR INTERFACE LVGL
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    if (xSemaphoreTake(mutexLVGL, pdMS_TO_TICKS(10)) == pdTRUE) {
        
      set_var_descongelar(0);
      xSemaphoreGive(mutexLVGL);
    }

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // REANUDAR FUNCIONAMIENTO NORMAL
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // Solo reanudamos si el depósito está puesto, para evitar arranques indeseados..
    if (Deposito == 0) {
      
      if (xTaskFuncionamientoHandle != NULL) {

        vTaskResume(xTaskFuncionamientoHandle);
        vTaskResume(xTaskAnalisisHandle);
      } 
    }
      
    else {

      if (xTaskAnalisisHandle != NULL) {

        vTaskResume(xTaskAnalisisHandle);
      } 
    }
    
    Desescarchando = 0;

  }
}


//===============================================================================
// TASK OCULTAR LOGO INICIAL
//===============================================================================
void TaskOcultarLogo(void *pvParameters) {
  
  vTaskDelay(pdMS_TO_TICKS(3000));
  set_var_logo(1);

  vTaskDelete(NULL); // Eliminar esta tarea, ya no es necesaria.
}

////////////////////////////////////////////////////////////////////////////////////
// CONFIGURACIÓN ///////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////
void setup() {

  //================================================================================
  // CONFIGURACIÓN E/S
  //================================================================================
  pinMode(S_Llenado, INPUT);

  pinMode(Compresor, OUTPUT);
  pinMode(Ventilador, OUTPUT);
  pinMode(Buzzer, OUTPUT);

  //================================================================================
  // UART O
  //================================================================================
  Serial.begin(115200);

  //================================================================================
  // BUS I2C
  //================================================================================
  Wire.begin();

  //================================================================================
  // CONFIGURAR SENSOR SHT45
  //================================================================================
  sht4x.begin(Wire, SHT40_I2C_ADDR_44);

  //================================================================================
  // INICIALIZACIÓN DE LA PANTALLA Y EL TOUCH
  //================================================================================
  SPI.begin();            // Inicializar bus SPI.
  tft.begin();            // Inicializar pantalla TFT.
  tft.setRotation(1);     // Rotar pantalla.
  touch.begin();          // Inicializar táctil.
  touch.setRotation(1);   // Rotar táctil.

  //================================================================================
  // MUTEX DE PROTECCIÓN
  //================================================================================
  mutexTempHum = xSemaphoreCreateMutex(); // Crear el mutex
  mutexEEPROM = xSemaphoreCreateMutex();  // Crear el mutex
  mutexLVGL = xSemaphoreCreateMutex();    // Crear el mutex

  //================================================================================
  // CALIBRACIÓN DEL TOUCH
  //================================================================================
  // Cargar calibración de EEPROM o entrar en rutina

  EEPROM.begin(128);

  if(!loadCalibration()) {
    Serial.println("No hay calibracion, entrando en rutina...");
    
    EEPROM.put(28, Humedad_umbral);
    EEPROM.put(32, Tiempo_limite);
    EEPROM.put(36, Alarma);
    EEPROM.commit();

    delay(100);

    calibrate();

  } 
  
  else {
    Serial.println("Calibracion cargada de EEPROM");

  }
  
  //================================================================================
  // CARGAR CONFIGURACIONES DE LA EEPROM
  //================================================================================
  EEPROM.begin(128);
  EEPROM.get(28, Humedad_umbral);
  EEPROM.get(32, Tiempo_limite);
  EEPROM.get(36, Alarma);
  EEPROM.end();

  Tiempo_limite = constrain(Tiempo_limite, 0.0, 24.0); 

  //================================================================================
  // INICIALIZAR LVGL
  //================================================================================
  // --- Inicialización LVGL ---
  lv_init();
  lv_disp_draw_buf_init(&draw_buf, buf, NULL, BUF_LINES * TFT_WIDTH);

  // --- Configuración del driver de la pantalla ---
  static lv_disp_drv_t disp_drv;      // Declaración del driver de pantalla.
  lv_disp_drv_init(&disp_drv);        // Inicialización del driver de pantalla.
  disp_drv.hor_res = TFT_WIDTH;       // Resolución horizontal de la pantalla.
  disp_drv.ver_res = TFT_HEIGHT;      // Resolución vertical de la pantalla.
  disp_drv.draw_buf = &draw_buf;      // Asignar el buffer de dibujo al driver.
  disp_drv.flush_cb = my_disp_flush;  // Función de callback para actualizar la pantalla.
  lv_disp_drv_register(&disp_drv);    // Registrar el driver de pantalla en LVGL.

  // --- Configuración del driver de entrada táctil ---
  static lv_indev_drv_t indev_drv;          // Declaración del driver de entrada.
  lv_indev_drv_init(&indev_drv);            // Inicialización del driver del táctil.
  indev_drv.type = LV_INDEV_TYPE_POINTER;   //Tipo: Puntero.
  indev_drv.read_cb = my_touchpad_read;     // Función para leer coordenadas del del táctil.
  lv_indev_drv_register(&indev_drv);        // Registrar el driver de entrada.


  //================================================================================
  // INICIALIZAR INTERFACT GRÁFICA
  //================================================================================
  ui_init();
  lv_last_tick = millis();
  set_var_logo(0);


  //================================================================================
  // CONFIGURAR BUZZER
  //================================================================================
  ledcDetachPin(Buzzer);                    // liberar canal
  ledcSetup(BUZZER_CH, 2000, BUZZER_RES);   // 2 kHz inicial
  //ledcWriteTone(BUZZER_CH, 1000);         // 1 kHz
  ledcAttachPin(Buzzer, BUZZER_CH);  


  //==============================================================================
  // TASK LECTURA SHT45
  //==============================================================================
  // Crear la tarea para obtener datos del sensor SHT45
  xTaskCreatePinnedToCore(
    TaskSHT45,                  // Función de la tarea
    "TaskSHT45",                // Nombre de la tarea
    1600,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    1,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    0                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK MOSTRAR TEMPERATURA Y HUMEDAD EN PANTALLA TFT
  //==============================================================================
  // Crear la tarea para mostrar datos en la pantalla TFT
  xTaskCreatePinnedToCore(
    TaskMostrarTFT,             // Función de la tarea
    "TaskMostrarTFT",           // Nombre de la tarea
    4000,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    1,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    1                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK TÁCTIL Y LVGL
  //==============================================================================
  // Crear la tarea para el táctil y LVGL.
  xTaskCreatePinnedToCore(
    TaskTactilLVGL,             // Función de la tarea
    "TaskTactilLVGL",           // Nombre de la tarea
    3000,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    1,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    1                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK DEPÓSITO
  //==============================================================================
  // Crear la tarea para comprobar el nivel del depósito.
  xTaskCreatePinnedToCore(
    TaskDeposito,               // Función de la tarea
    "TaskDeposito",             // Nombre de la tarea
    1200,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    1,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    0                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK FUNCIONAMIENTO
  //==============================================================================
  // Crear la tarea para el funcionamiento del deshumificador.
  xTaskCreatePinnedToCore(
    TaskFuncionamiento,         // Función de la tarea
    "TaskFuncionamiento",       // Nombre de la tarea
    2000,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    1,                          // Prioridad de la tarea
    &xTaskFuncionamientoHandle, // Identificador de la tarea
    0                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK CONFIGURACIÓN HUMEDAD
  //==============================================================================
  // Crear la tarea para las configuraciones del deshumificador.
  xTaskCreatePinnedToCore(
    TaskConfiguracionHumedad,   // Función de la tarea
    "TaskConfiguracionHumedad", // Nombre de la tarea
    2000,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    2,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    1                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK CONFIGURACIÓN TIEMPO FUNCIONAMIENTO
  //==============================================================================
  // Crear la tarea para visualizar el tiempode funcionamiento.
  xTaskCreatePinnedToCore(
    TaskTFuncionamiento,        // Función de la tarea
    "TaskTFuncionamiento",      // Nombre de la tarea
    2000,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    2,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    1                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK CONFIGURACIONES CUENTA ATRÁS
  //==============================================================================
  // Crear la tarea para la desconexión automática.
  xTaskCreatePinnedToCore(
    TaskCuentaAtras,            // Función de la tarea
    "TaskCuentaAtras",          // Nombre de la tarea
    1300,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    2,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    1                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK CONFIGURACIONES CUENTA ATRÁS FINALIZADA
  //==============================================================================
  // Crear la tarea para finalización de la cuenta atrás.
  xTaskCreatePinnedToCore(
    TaskCuentaAtrasFin,         // Función de la tarea
    "TaskCuentaAtrasFin",       // Nombre de la tarea
    2300,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    2,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    1                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK CONFIGURACIONES ALARMA
  //==============================================================================
  // Crear la tarea para la configuración de la alarma.
  xTaskCreatePinnedToCore(
    TaskAlarma,                 // Función de la tarea
    "TaskAlarma",               // Nombre de la tarea
    2000,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    2,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    1                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK ANÁLISIS DEL FRÍO
  //==============================================================================
  // Crear la tarea para analizar la temperatura de funcionamiento.
  xTaskCreatePinnedToCore(
    TaskAnalisisFrio,           // Función de la tarea
    "TaskAnalisisFrio",         // Nombre de la tarea
    3100,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    2,                          // Prioridad de la tarea
    &xTaskAnalisisHandle,       // Identificador de la tarea
    0                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK DESESCARCHADO
  //==============================================================================
  // Crear la tarea para el ciclo de desescarchado del deshumificador.
  xTaskCreatePinnedToCore(
    TaskDesescarchado,          // Función de la tarea
    "TaskDesescarchado",        // Nombre de la tarea
    3100,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    2,                          // Prioridad de la tarea
    &xTaskDesescarchadoHandle,  // Identificador de la tarea
    0                           // Núcleo (0 o 1)
  );


  //==============================================================================
  // TASK OCULTAR LOGO
  //==============================================================================
  // Crear la tarea para ocultar el logo de la empresa.
  xTaskCreatePinnedToCore(
    TaskOcultarLogo,            // Función de la tarea
    "TaskOcultarLogo",          // Nombre de la tarea
    1000,                       // Tamaño del stack en palabras
    NULL,                       // Parámetro para la tarea
    1,                          // Prioridad de la tarea
    NULL,                       // Identificador de la tarea
    1                           // Núcleo (0 o 1)
  );

}


////////////////////////////////////////////////////////////////////////////////////
// PRINCIPAL ///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////
void loop() {

  // En este proyecto, el loop principal no hace nada, ya que todas las tareas se 
  // ejecutan en paralelo.
  // Sin embargo, es importante mantenerlo para que el sistema operativo FreeRTOS 
  // pueda gestionar las tareas correctamente.

}
