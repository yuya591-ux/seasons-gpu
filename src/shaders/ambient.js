// 配管確認用のシェーダー。色がゆっくり移ろう縦グラデーションと、やわらかなビネット。
// 本格的な現象（雨粒の屈折・水面・霧など）は今後この層を差し替えて作り込む。

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

export const fragmentSource = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;

    // ゆっくり移ろう時間（ループ感を抑えるため遅め）。
    float t = uTime * 0.06;

    // 上下で異なる色を、時間でじわじわずらす。
    vec3 top = vec3(
      0.30 + 0.18 * sin(t),
      0.26 + 0.18 * sin(t + 2.1),
      0.42 + 0.18 * sin(t + 4.2)
    );
    vec3 bottom = vec3(
      0.78 + 0.12 * sin(t + 1.0),
      0.50 + 0.16 * sin(t + 3.0),
      0.40 + 0.16 * sin(t + 5.0)
    );

    vec3 col = mix(bottom, top, smoothstep(0.0, 1.0, uv.y));

    // 中心をわずかに明るく、周辺をやわらかく落とすビネット。
    float d = distance(uv, vec2(0.5));
    col *= 1.0 - 0.35 * smoothstep(0.2, 1.1, d);

    gl_FragColor = vec4(col, 1.0);
  }
`
