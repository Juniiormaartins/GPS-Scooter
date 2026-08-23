/**
 * Conexão real com o veículo via Web Bluetooth (BLE) — nenhum dado de
 * bateria é mostrado sem uma conexão de verdade. Ver hooks/useVehicleBluetooth.ts
 * para o hook React que consome este serviço.
 *
 * LIMITAÇÕES REAIS, verificadas antes de implementar (não hipotéticas):
 * - Web Bluetooth NÃO existe no WebKit — ou seja, não funciona em NENHUM
 *   navegador no iOS (Safari, e também Chrome/Firefox para iOS, que no iOS
 *   são obrigatoriamente WebKit por baixo). Não há como contornar isso a
 *   partir do app; é uma limitação de plataforma da Apple, não deste código.
 *   Funciona em Chrome/Edge desktop e Android (contexto seguro/HTTPS).
 * - Não existe um protocolo BLE universal de "scooter elétrica". O único
 *   dado que dá para ler de forma genérica e padronizada é o serviço GATT
 *   padrão "battery_service" (0x180F)/característica "battery_level"
 *   (0x2A19) — parte do Bluetooth SIG, mas nem todo fabricante de scooter
 *   implementa esse serviço padrão (muitos usam protocolo proprietário,
 *   só acessível com o SDK/app oficial do fabricante). Por isso: ligar
 *   com sucesso via Bluetooth não garante necessariamente ter acesso a
 *   bateria — o app trata isso como dois estados diferentes e reais.
 */

export type BluetoothConnectionStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'error'

export interface VehicleTelemetry {
  deviceName: string | null
  /** Percentual de bateria real, lido do serviço GATT padrão do dispositivo — null quando o dispositivo não expõe esse serviço (não é um valor "quase certo", é ausência confirmada). */
  batteryPercent: number | null
}

const BATTERY_SERVICE = 'battery_service'
const BATTERY_LEVEL_CHARACTERISTIC = 'battery_level'

// Web Bluetooth não tem tipos no lib.dom.d.ts do TypeScript — declaração
// mínima só do que este arquivo realmente usa, não uma tipagem completa da API.
interface BleCharacteristic {
  readValue(): Promise<DataView>
}
interface BleService {
  getCharacteristic(uuid: string): Promise<BleCharacteristic>
}
interface BleServer {
  connected: boolean
  connect(): Promise<BleServer>
  disconnect(): void
  getPrimaryService(uuid: string): Promise<BleService>
}
interface BleDevice extends EventTarget {
  name?: string
  gatt?: BleServer
}
interface BluetoothNavigator {
  bluetooth?: {
    requestDevice(options: { acceptAllDevices?: boolean; optionalServices?: string[] }): Promise<BleDevice>
  }
}

export const isWebBluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator

/**
 * Abre o seletor nativo do navegador para escolher um dispositivo BLE por
 * perto, conecta ao servidor GATT e tenta ler o serviço padrão de bateria.
 * Lança se o usuário cancelar a seleção ou se a conexão falhar — quem chama
 * decide como comunicar isso (nunca mostra bateria nesse caminho de erro).
 */
export async function connectVehicleBluetooth(
  onDisconnected: () => void,
): Promise<{ device: BleDevice; telemetry: VehicleTelemetry }> {
  const bluetooth = (navigator as BluetoothNavigator).bluetooth
  if (!bluetooth) throw new Error('Web Bluetooth não é suportado neste navegador.')

  const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [BATTERY_SERVICE] })
  device.addEventListener('gattserverdisconnected', onDisconnected)

  const server = await device.gatt?.connect()
  if (!server) throw new Error('Não foi possível conectar ao dispositivo.')

  const telemetry: VehicleTelemetry = { deviceName: device.name ?? null, batteryPercent: null }
  try {
    const service = await server.getPrimaryService(BATTERY_SERVICE)
    const characteristic = await service.getCharacteristic(BATTERY_LEVEL_CHARACTERISTIC)
    const value = await characteristic.readValue()
    telemetry.batteryPercent = value.getUint8(0)
  } catch {
    // Dispositivo conectado, mas sem o serviço padrão de bateria exposto —
    // estado real e esperado para a maioria das scooters (protocolo
    // proprietário). Mantém batteryPercent null; nunca inventa um valor.
  }

  return { device, telemetry }
}

export function disconnectVehicleBluetooth(device: BleDevice) {
  device.gatt?.disconnect()
}
