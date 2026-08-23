/**
 * DADOS DE DEMONSTRAÇÃO — NÃO é uma integração real.
 * `batteryPercent` representa a carga INICIAL assumida no começo da sessão
 * (não há telemetria real do veículo — BLE/app do fabricante/etc. — nesta
 * fase). A partir daí, services/vehicle/batteryEstimate.ts deriva uma
 * estimativa de bateria restante conforme a distância percorrida. Toda UI
 * que exibir esse valor (inicial ou estimado) deve deixar claro que é uma
 * estimativa, nunca uma leitura real. Quando houver integração de hardware,
 * substituir este módulo por um hook que leia o dado real — nenhum outro
 * componente deve depender do formato aqui além do shape de VehicleStatus.
 */

export interface VehicleStatus {
  batteryPercent: number
}

export const MOCK_VEHICLE_STATUS: VehicleStatus = {
  batteryPercent: 85,
}
