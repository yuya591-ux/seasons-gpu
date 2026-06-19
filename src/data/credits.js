// アプリ内「この作品について（出典）」で表示する素材クレジット。
// CC BY / CC BY-SA 素材は、配信される作品の中で帰属表示する義務があるため、ここをUIから閲覧できるようにする。
// 出典の正本は CREDITS.md。本ファイルは利用者向けの要約（作者・ライセンス・出典URL）。両者を一致させること。

export const CREDIT_INTRO =
  '環境音・背景画像は、ライセンスが明確なフリー素材（CC0／パブリックドメイン優先）のみを使っています。作者と出典をここに記します。'

// 環境音（実在の録音。すべて Ogg→MP3 へ変換して同梱）
export const CREDIT_SOUNDS = [
  { title: 'Rain against the window', by: 'Cori Samuel', license: 'パブリックドメイン', url: 'https://commons.wikimedia.org/wiki/File:Rain_against_the_window.ogg', note: '雨音' },
  { title: 'Tanna japonensis v01（ヒグラシ）', by: 'Σ64', license: 'CC BY 4.0', url: 'https://commons.wikimedia.org/wiki/File:Tanna_japonensis_v01.ogg', note: 'ヒグラシ' },
  { title: 'Thunder', by: 'Bidgee', license: 'CC BY 3.0', url: 'https://commons.wikimedia.org/wiki/File:Thunder.ogg', note: '遠雷' },
  { title: 'Aburazemi 07z7315（アブラゼミ）', by: 'ISAKA Yoji (Cory)', license: 'CC BY 2.1 JP', url: 'https://commons.wikimedia.org/wiki/File:Aburazemi_07z7315.ogg', note: '油蝉' },
  { title: 'Waves', by: 'Dsw4', license: 'パブリックドメイン', url: 'https://commons.wikimedia.org/wiki/File:Waves.ogg', note: '波' },
  { title: 'Black-headed Gulls（ユリカモメ）', by: 'Lawrence Shove / The British Library Board', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Black-headed_Gulls_(Larus_ridibundus)_(W1CDR0001402_BD19).ogg', note: 'カモメ' },
  { title: 'Froesche rieselfelder（カエルの合唱）', by: 'Guido Gerding (XN)', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Froesche_rieselfelder.ogg', note: 'かえる' },
  { title: 'Grillo (Cricket)', by: 'Luisalvaz', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Grillo_(Cricket).ogg', note: '虫の音' },
  { title: 'Carrion Crow（ハシボソガラス）', by: 'Lawrence Shove / The British Library Board', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Carrion_Crow_(Corvus_corone)_(W1CDR0001425_BD18).ogg', note: 'カラス' },
  { title: 'Uguisu5707（ウグイス）', by: 'Jnn', license: 'CC BY 2.1 JP', url: 'https://commons.wikimedia.org/wiki/File:Uguisu5707.ogg', note: 'ウグイス' },
  { title: 'Flowing-water-100019', by: 'Fg2', license: 'パブリックドメイン', url: 'https://commons.wikimedia.org/wiki/File:Flowing-water-100019.ogg', note: 'せせらぎ' },
  { title: 'Wind in Swedish pine forest at 25 mps', by: 'W.carter', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Wind_in_Swedish_pine_forest_at_25_mps.ogg', note: '風' },
]

// 窓の外の絵（外部AIで開発時に生成。本番は保存画像を表示するだけ＝実行時に外部APIは叩かない）
export const CREDIT_IMAGES = [
  { title: '窓の外の風景・遠景（生成画像）', by: 'Pollinations.AI / Flux（無料・オープンソース）', license: 'AI生成物', url: 'https://pollinations.ai/', note: '雨ガラス／実写の窓／立体の街の遠景' },
  { title: 'Real-ESRGAN（超解像）', by: 'Xintao Wang ほか', license: 'BSD-3-Clause', url: 'https://github.com/xinntao/Real-ESRGAN', note: '実写の窓の画像を開発時に高精細化' },
  { title: 'Basel Martinsgasse Panorama（実証用）', by: 'DerMische', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Basel_Martinsgasse_Panorama.jpg', note: '立体パノラマの実証用' },
]

// 描画・道具
export const CREDIT_TOOLS = [
  { title: 'three.js', by: 'mrdoob ほか', license: 'MIT', url: 'https://threejs.org/', note: '立体の街の描画' },
  { title: '@mkkellogg/gaussian-splats-3d', by: 'Mark Kellogg', license: 'MIT', url: 'https://github.com/mkkellogg/GaussianSplats3D', note: '実証用スプラット表示' },
]

// 作品自体の扱い（継承ライセンスの明示）
export const CREDIT_OUTRO =
  'この作品の独自部分（描画・データ・コード）は MIT ライセンスです。同梱の第三者素材は上記それぞれのライセンスに従います。CC BY-SA 素材を含むため、それらの素材は CC BY-SA を継承します。詳細はリポジトリの CREDITS.md / LICENSE をご覧ください。'
