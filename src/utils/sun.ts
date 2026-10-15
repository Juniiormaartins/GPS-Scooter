/**
 * Altura do sol sobre o horizonte, em graus, para um instante e um lugar.
 *
 * Existe para saber se JÁ ESCURECEU sem chutar uma hora fixa: o pôr do sol em
 * Goiânia varia cerca de uma hora ao longo do ano, e "depois das 18h" estaria
 * errado em metade das épocas. Fórmula astronômica padrão (precisão de ~0,1°,
 * de sobra para decidir sobre lanterna). Sem rede, sem dependência.
 */
export function sunElevationDeg(date: Date, lat: number, lng: number): number {
  const rad = Math.PI / 180
  const norm = (deg: number) => ((deg % 360) + 360) % 360

  const jd = date.getTime() / 86400000 + 2440587.5
  const n = jd - 2451545.0

  const meanLongitude = norm(280.46 + 0.9856474 * n)
  const meanAnomaly = norm(357.528 + 0.9856003 * n)
  const eclipticLongitude =
    meanLongitude + 1.915 * Math.sin(meanAnomaly * rad) + 0.02 * Math.sin(2 * meanAnomaly * rad)
  const obliquity = 23.439 - 0.0000004 * n

  const declination = Math.asin(Math.sin(obliquity * rad) * Math.sin(eclipticLongitude * rad))
  const rightAscensionDeg =
    Math.atan2(Math.cos(obliquity * rad) * Math.sin(eclipticLongitude * rad), Math.cos(eclipticLongitude * rad)) / rad

  const greenwichSiderealDeg = norm((18.697374558 + 24.06570982441908 * n) * 15)
  const hourAngle = norm(greenwichSiderealDeg + lng - rightAscensionDeg) * rad

  const sinAltitude =
    Math.sin(lat * rad) * Math.sin(declination) + Math.cos(lat * rad) * Math.cos(declination) * Math.cos(hourAngle)
  return Math.asin(sinAltitude) / rad
}

/**
 * "Precisa de luz acesa": o sol já está abaixo do horizonte o bastante para o
 * céu deixar de iluminar a rua. -2° e não 0° — no minuto do pôr do sol ainda é
 * dia claro, e a dica só faz sentido quando o motorista de trás já não enxerga
 * bem.
 */
export function needsLights(date: Date, lat: number, lng: number): boolean {
  return sunElevationDeg(date, lat, lng) < -2
}
