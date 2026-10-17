/**
 * Roda no CI logo depois de `npx cap add android`. Aplica por cima do projeto
 * Android gerado tudo o que e nosso: permissoes, filtros de intent (abrir
 * endereco vindo de outros apps), a MainActivity, o icone e a versao.
 *
 * Por que script em vez de commitar a pasta android/: ela e inteiramente
 * gerada, e ficaria presa a uma versao do Capacitor. Aqui so mora o que muda.
 *
 * Falha ALTO (throw) se algo esperado nao for encontrado: um patch que nao
 * aplicou nao pode virar um APK "bonito" que silenciosamente nao abre enderecos.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Todo o patch num try: o log completo do CI nao e legivel fora do navegador, mas
// anotacoes `::error::` sim — e e nelas que o motivo da falha aparece.
try {
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const android = join(raiz, 'android')
const config = JSON.parse(readFileSync(join(raiz, 'capacitor.config.json'), 'utf8'))
const pacote = config.appId
const site = String(config.server?.url ?? '').replace(/\/$/, '')
if (!site) throw new Error('capacitor.config.json sem server.url')

function exige(condicao, mensagem) {
  if (!condicao) throw new Error(`patch-android: ${mensagem}`)
}

// 1. AndroidManifest: permissoes + filtros de intent --------------------------
const manifestPath = join(android, 'app/src/main/AndroidManifest.xml')
let manifest = readFileSync(manifestPath, 'utf8')

const permissoes = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.WAKE_LOCK',
]
const linhasPermissao = permissoes
  .filter((p) => !manifest.includes(p))
  .map((p) => `    <uses-permission android:name="${p}" />`)
  .join('\n')
exige(manifest.includes('</manifest>'), 'manifest sem </manifest>')
manifest = manifest.replace('</manifest>', `${linhasPermissao}\n</manifest>`)

const filtros = `
            <!-- Outros apps pedindo para abrir um endereco/coordenada -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="geo" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="google.navigation" />
            </intent-filter>
            <!-- "Compartilhar" um endereco em texto -->
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>
`
// Insere antes do fechamento da <activity> principal (a que tem o LAUNCHER).
const fechaActivity = manifest.indexOf('</activity>')
exige(fechaActivity > 0, 'manifest sem </activity>')
manifest = manifest.slice(0, fechaActivity) + filtros + '        ' + manifest.slice(fechaActivity)
exige(/android:launchMode="singleTask"/.test(manifest), 'MainActivity sem launchMode singleTask')
writeFileSync(manifestPath, manifest)

// 2. MainActivity -----------------------------------------------------------------
const pastaJava = join(android, 'app/src/main/java', ...pacote.split('.'))
mkdirSync(pastaJava, { recursive: true })
const modelo = readFileSync(join(raiz, 'overlay/MainActivity.java.template'), 'utf8')
writeFileSync(join(pastaJava, 'MainActivity.java'), modelo.replaceAll('%%PACKAGE%%', pacote).replaceAll('%%URL%%', site))

// 3. Icone (a partir do icone do PWA) ----------------------------------------------
const icone = join(raiz, '..', 'public/icons/icon-512.png')
exige(existsSync(icone), 'public/icons/icon-512.png nao encontrado')
const res = join(android, 'app/src/main/res')
// O molde do Capacitor usa icone adaptativo (anydpi-v26) que prevaleceria sobre os PNG.
for (const pasta of readdirSync(res).filter((p) => p.startsWith('mipmap-anydpi'))) {
  rmSync(join(res, pasta), { recursive: true, force: true })
}
const tamanhos = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
for (const [densidade, px] of Object.entries(tamanhos)) {
  const destino = join(res, `mipmap-${densidade}`)
  mkdirSync(destino, { recursive: true })
  for (const nome of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const arquivo = join(destino, nome)
    // ImageMagick 7 expoe `magick`; o 6 so tem `convert`.
    try {
      execFileSync('magick', [icone, '-resize', `${px}x${px}`, arquivo], { stdio: 'pipe' })
    } catch (erroMagick) {
      if (erroMagick.code !== 'ENOENT') throw erroMagick
      execFileSync('convert', [icone, '-resize', `${px}x${px}`, arquivo], { stdio: 'pipe' })
    }
  }
}

// 4. Versao (o Android so atualiza por cima se versionCode subir) -------------------
const gradlePath = join(android, 'app/build.gradle')
let gradle = readFileSync(gradlePath, 'utf8')
const versionCode = process.env.VERSION_CODE ?? '1'
const versionName = process.env.VERSION_NAME ?? '0.1.0'
exige(/versionCode\s+\d+/.test(gradle), 'build.gradle sem versionCode')
exige(/versionName\s+"[^"]*"/.test(gradle), 'build.gradle sem versionName')
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`)
writeFileSync(gradlePath, gradle)

console.log(`patch-android: ok (pacote ${pacote}, site ${site}, versao ${versionName} / ${versionCode})`)
} catch (erro) {
  const detalhe = [erro?.message, erro?.stderr?.toString()].filter(Boolean).join(' | ')
  console.log(`::error title=patch-android falhou::${detalhe.replace(/\r?\n/g, '%0A').slice(0, 900)}`)
  process.exit(1)
}
