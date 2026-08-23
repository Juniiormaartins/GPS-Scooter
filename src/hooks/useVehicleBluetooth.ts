import { useCallback, useRef, useState } from 'react'
import {
  connectVehicleBluetooth,
  disconnectVehicleBluetooth,
  isWebBluetoothSupported,
  type BluetoothConnectionStatus,
  type VehicleTelemetry,
} from '@/services/vehicle/bluetoothConnection'

interface VehicleBluetoothState {
  status: BluetoothConnectionStatus
  deviceName: string | null
  batteryPercent: number | null
  errorMessage: string | null
}

/**
 * Estado de conexão real com o veículo via Bluetooth — nunca simulado.
 * `status === 'unsupported'` cobre o caso mais comum na prática: iOS/Safari,
 * onde a Web Bluetooth API simplesmente não existe (ver bluetoothConnection.ts).
 */
export function useVehicleBluetooth() {
  const [state, setState] = useState<VehicleBluetoothState>({
    status: isWebBluetoothSupported ? 'disconnected' : 'unsupported',
    deviceName: null,
    batteryPercent: null,
    errorMessage: null,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null)

  const handleDisconnected = useCallback(() => {
    deviceRef.current = null
    setState({ status: 'disconnected', deviceName: null, batteryPercent: null, errorMessage: null })
  }, [])

  const connect = useCallback(async () => {
    if (!isWebBluetoothSupported) return
    setState((prev) => ({ ...prev, status: 'connecting', errorMessage: null }))
    try {
      const { device, telemetry } = await connectVehicleBluetooth(handleDisconnected)
      deviceRef.current = device
      setState({ status: 'connected', deviceName: telemetry.deviceName, batteryPercent: telemetry.batteryPercent, errorMessage: null })
    } catch (error) {
      setState({
        status: 'disconnected',
        deviceName: null,
        batteryPercent: null,
        errorMessage: error instanceof Error ? error.message : 'Não foi possível conectar ao veículo.',
      })
    }
  }, [handleDisconnected])

  const disconnect = useCallback(() => {
    if (deviceRef.current) disconnectVehicleBluetooth(deviceRef.current)
    handleDisconnected()
  }, [handleDisconnected])

  return { ...state, isSupported: isWebBluetoothSupported, connect, disconnect }
}

export type { VehicleTelemetry }
