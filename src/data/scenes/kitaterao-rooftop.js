// 番外「北寺尾の屋上、谷戸を一望」。作者が馴染んだ7階建てマンション（サンライズ北寺尾を想起）の
// 屋上の抜けた区画からの、開けた“ほぼ360°”パノラマ。横浜市鶴見区北寺尾〜獅子ヶ谷の昭和後期〜平成初期の
// 風景を、地形と佇まいで再現（実在の商標・固有意匠は模さない）。見回すと小学校・学園のテニスコート/
// グラウンド・サッカーのグラウンド＋ゲーム屋などが現れる。夕暮れ前の澄んだ午後。

export default {
  id: 'kitaterao-rooftop',
  axes: { season: 'summer', weather: 'clear', time: 'dusk' },
  label: '北寺尾の屋上、谷戸を一望',
  desc: '馴染みの7階建ての屋上から、坂の住宅地と森、思い出のグラウンドを見渡す。見回せる開けた眺め。',
  status: 'ready',
  render: 'kitateraoRooftop',
  lowRise: true,
  intensityLabel: '街あかり',
  panX: 3.0, // 屋上は見回しの可動域を広げてほぼ360°見渡せる

  palette: {
    early: {
      skyTop: '#496aae', // 澄んだ午後の深い青
      skyMid: '#a6c2dc',
      horizon: '#f8dcb2', // 夕暮れ前の暖かな金の地平
      sunGlow: '#ffe2ae',
      dropTint: '#2e4428', // 市民の森の深緑
    },
    late: {
      skyTop: '#37406e',
      skyMid: '#7c7896',
      horizon: '#f2a772', // 燃える夕焼け
      sunGlow: '#ffc486',
      dropTint: '#26371f',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  // 屋上の風（既存のCC0素材を再利用）。
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.14, loop: true },
  ],
}
