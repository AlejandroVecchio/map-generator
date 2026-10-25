// ---------- subir un boceto de mapa (tecla U): un dibujo en papel que se vuelve parte de Eldervald ----------
// Se sube una foto o un escaneo de un mapa dibujado a mano con los colores de la leyenda (azul agua, negro o marrón
// caminos, verde bosque, rojo casas, amarillo claros, naranja fogatas, violeta piedras rúnicas, gris relleno rocas).
// El motor lo lee sin IA: equilibra el blanco del papel, pasa cada punto a su color de la leyenda, junta lo que se
// toca y decide si es una línea (camino, río) o una mancha (laguna, bosque, pueblo, claro); de las líneas saca el
// trazo con sus ramas y de las manchas su forma. El panel dice qué tiene que cumplir la hoja y qué no se pudo leer.
// Se ve como vista previa en el mapa (la hoja apoyada en el piso, en el centro de la vista, del ancho elegido) y se
// aplica con un paso de Deshacer. «Activar IA» manda la hoja y lo que leyó el motor a la IA del panel 8 (Claude,
// ChatGPT o Gemini, con su clave guardada solo en este navegador) para que corrija lo mal leído y sume lo que falte.
window.EDITOR_BOCETO = (function () {
  "use strict";
  const E = window.EDITOR,
    W = E.W,
    t = E.t,
    $ = (id) => document.getElementById(id);
  const panel = $("boPanel");
  const LADO = 320, // la grilla de lectura: el lado largo de la hoja en puntos
    MEZCLA = [["pino", 55], ["roble", 22], ["abedul", 15], ["abetoAnciano", 4], ["roca", 4]];
  // las clases de la leyenda y su color en la vista de lo leído
  const CLASES = ["agua", "trazo", "marron", "bosque", "casa", "claro", "fuego", "runa"];
  const COLOR = { agua: "#4A78D0", trazo: "#111111", marron: "#7A4A26", bosque: "#3E7A3A", casa: "#C8402D", claro: "#FFD98A", fuego: "#FF8D71", runa: "#9A6BD8" };
  let hoja = null, // { img, w, h, ancho (px de la foto), alto }
    lectura = null, // lo que leyó el motor (o la IA): { caminos, rios, lagos, bosques, claros, poner, avisos }
    propuesta = null, // { poner, caminos, rios, lagos, quitar }
    centro = null, // [x, y] del mundo donde va el centro de la hoja
    ia = false,
    pensando = false;

  // ---------- leer la hoja ----------
  // cada punto → su clase. Primero se mide el papel (los puntos más claros) y se equilibra todo contra él.
  function claseDe(r, g, b) {
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      s = mx ? (mx - mn) / mx : 0,
      l = (mx + mn) / 510;
    if (mx < 80) return "trazo";
    if (s < 0.24) return l > 0.66 ? null : "trazo";
    let h;
    if (mx === r) h = ((g - b) / (mx - mn)) * 60;
    else if (mx === g) h = (2 + (b - r) / (mx - mn)) * 60;
    else h = (4 + (r - g) / (mx - mn)) * 60;
    if (h < 0) h += 360;
    if (h < 14 || h >= 332) return "casa";
    if (h < 42) return mx < 165 ? "marron" : "fuego";
    if (h < 70) return s < 0.4 ? null : "claro";
    if (h < 170) return "bosque";
    if (h < 258) return "agua";
    return "runa";
  }
  function leerHoja() {
    const { img, ancho, alto } = hoja,
      k = LADO / Math.max(ancho, alto),
      w = Math.max(8, Math.round(ancho * k)),
      h = Math.max(8, Math.round(alto * k));
    // al doble y después el punto con más tinta de cada 2×2: así no se pierden las líneas finas de lápiz
    const cv = document.createElement("canvas");
    cv.width = w * 2;
    cv.height = h * 2;
    const c = cv.getContext("2d", { willReadFrequently: true });
    c.drawImage(img, 0, 0, w * 2, h * 2);
    const px = c.getImageData(0, 0, w * 2, h * 2).data;
    // el papel: el promedio del 25 % más claro, canal por canal
    const lum = [];
    for (let i = 0; i < px.length; i += 4) lum.push(px[i] + px[i + 1] + px[i + 2]);
    const corte = lum.slice().sort((a, b) => b - a)[Math.floor(lum.length * 0.25)];
    let pr = 0,
      pg = 0,
      pb = 0,
      pn = 0;
    for (let i = 0; i < px.length; i += 4)
      if (px[i] + px[i + 1] + px[i + 2] >= corte) (pr += px[i]), (pg += px[i + 1]), (pb += px[i + 2]), pn++;
    const fr = 245 / Math.max(40, pr / pn),
      fg = 245 / Math.max(40, pg / pn),
      fb = 245 / Math.max(40, pb / pn);
    const cl = new Array(w * h).fill(null);
    let papel = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let mejor = null,
          tinta = -1;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const i = ((y * 2 + dy) * w * 2 + x * 2 + dx) * 4,
              r = Math.min(255, px[i] * fr),
              g = Math.min(255, px[i + 1] * fg),
              b = Math.min(255, px[i + 2] * fb),
              ti = 765 - r - g - b + (Math.max(r, g, b) - Math.min(r, g, b)) * 2;
            if (ti > tinta) (tinta = ti), (mejor = [r, g, b]);
          }
        const q = claseDe(...mejor);
        cl[y * w + x] = q;
        if (!q) papel++;
      }
    // un pasado de mayoría 3×3: limpia los bordes de un color que se leen como otro (el rojo que se ve naranja)
    const limpia = cl.slice();
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const yo = cl[y * w + x];
        if (!yo) continue;
        const votos = {};
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const v = cl[(y + dy) * w + x + dx];
          if (v) votos[v] = (votos[v] || 0) + 1;
        }
        let gana = yo;
        for (const v in votos) if (votos[v] > votos[gana]) gana = v;
        limpia[y * w + x] = gana;
      }
    return { w, h, cl: limpia, papel: papel / (w * h) };
  }

  // ---------- manchas y líneas ----------
  const V8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]];
  function manchas(g) {
    const { w, h, cl } = g,
      id = new Int32Array(w * h).fill(-1),
      l = [];
    for (let i = 0; i < w * h; i++) {
      if (!cl[i] || id[i] >= 0) continue;
      const q = cl[i],
        n = l.length,
        pts = [i];
      id[i] = n;
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k],
          x = p % w,
          y = (p / w) | 0;
        for (const [dx, dy] of V8) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (id[j] < 0 && cl[j] === q) (id[j] = n), pts.push(j);
        }
      }
      l.push({ n, clase: q, pts });
    }
    g.id = id;
    return l;
  }
  // el camino más largo adentro de un conjunto de puntos (dos búsquedas a lo ancho); devuelve los puntos en orden
  function masLargo(g, set, desde) {
    const w = g.w;
    const buscar = (s) => {
      const d = new Map([[s, 0]]),
        de = new Map(),
        cola = [s];
      let lejos = s;
      // Dijkstra simple con pasos de 1 y 1,41: la cola se ordena de a ratos, alcanza para manchas chicas
      for (let k = 0; k < cola.length; k++) {
        const p = cola[k],
          x = p % w,
          y = (p / w) | 0,
          dp = d.get(p);
        if (dp > d.get(lejos)) lejos = p;
        for (const [dx, dy, c] of V8) {
          const j = (y + dy) * w + x + dx;
          if (!set.has(j) || x + dx < 0 || x + dx >= w) continue;
          const nd = dp + c;
          if (!d.has(j) || nd < d.get(j) - 0.01) d.set(j, nd), de.set(j, p), cola.push(j);
        }
      }
      return { lejos, d, de };
    };
    const a = buscar(desde).lejos,
      b = buscar(a),
      camino = [];
    for (let p = b.lejos; p !== undefined; p = b.de.get(p)) camino.push(p);
    return { camino, largo: b.d.get(b.lejos) };
  }
  // achicar una línea de puntos (Ramer-Douglas-Peucker)
  function simplificar(p, eps) {
    if (p.length < 3) return p;
    const [ax, ay] = p[0],
      [bx, by] = p[p.length - 1],
      L = Math.hypot(bx - ax, by - ay) || 1;
    let mx = 0,
      mi = 0;
    for (let i = 1; i < p.length - 1; i++) {
      const d = Math.abs((bx - ax) * (ay - p[i][1]) - (ax - p[i][0]) * (by - ay)) / L;
      if (d > mx) (mx = d), (mi = i);
    }
    if (mx <= eps) return [p[0], p[p.length - 1]];
    return simplificar(p.slice(0, mi + 1), eps).slice(0, -1).concat(simplificar(p.slice(mi), eps));
  }
  // una mancha alargada → sus trazos (el principal y las ramas, cada una pegada a donde sale)
  function trazos(g, m) {
    const w = g.w,
      set = new Set(m.pts),
      l = [];
    let resto = set,
      vueltas = 0,
      grueso = 2;
    while (resto.size && vueltas++ < 8) {
      const ini = resto.values().next().value,
        { camino, largo } = masLargo(g, resto, ini);
      if (vueltas === 1) grueso = Math.max(1, m.pts.length / Math.max(1, largo));
      if (largo < Math.max(5, grueso * 3)) break;
      const pts = camino.map((p) => [p % w, (p / w) | 0]);
      l.push(simplificar(pts, 1.2));
      // lo que queda lejos de los trazos ya sacados son las ramas
      const todos = l.flat(),
        r = grueso / 2 + 1.5,
        nuevo = new Set();
      resto.forEach((p) => {
        const x = p % w,
          y = (p / w) | 0;
        if (!camino.some((q) => Math.abs((q % w) - x) <= r && Math.abs(((q / w) | 0) - y) <= r) && !todos.some((q) => Math.hypot(q[0] - x, q[1] - y) <= r)) nuevo.add(p);
      });
      // solo los pedazos que tocan la línea se siguen (lo suelto lo levanta su propia mancha)
      resto = nuevo;
      if (resto.size < grueso * 4) break;
    }
    // cada rama arranca en el punto más cercano de lo ya trazado
    for (let i = 1; i < l.length; i++) {
      const prev = l.slice(0, i).flat(),
        cerca = (q) => prev.reduce((m0, p) => Math.min(m0, Math.hypot(p[0] - q[0], p[1] - q[1])), 1e9),
        a = l[i][0],
        b = l[i][l[i].length - 1];
      if (cerca(b) < cerca(a)) l[i].reverse();
      const p0 = l[i][0],
        pega = prev.reduce((m0, p) => (Math.hypot(p[0] - p0[0], p[1] - p0[1]) < Math.hypot(m0[0] - p0[0], m0[1] - p0[1]) ? p : m0), prev[0]);
      if (Math.hypot(pega[0] - p0[0], pega[1] - p0[1]) < grueso * 3 + 4) l[i].unshift(pega.slice());
    }
    return { lineas: l, grueso };
  }
  // lo gordo de una mancha (lo que queda después de achicarla k veces, vuelto a su tamaño) y lo fino que sobra
  function separar(g, pts, k) {
    const w = g.w,
      S = new Set(pts),
      N4 = [1, -1, w, -w];
    let vivo = S;
    for (let i = 0; i < k; i++) {
      const sig = new Set();
      vivo.forEach((p) => N4.every((d) => vivo.has(p + d)) && sig.add(p));
      vivo = sig;
    }
    const visto = new Set(),
      gordos = [],
      tapado = new Set();
    vivo.forEach((p0) => {
      if (visto.has(p0)) return;
      const grupo = [p0];
      visto.add(p0);
      for (let i = 0; i < grupo.length; i++)
        for (const [dx, dy] of V8) {
          const j = grupo[i] + dy * w + dx;
          if (vivo.has(j) && !visto.has(j)) visto.add(j), grupo.push(j);
        }
      if (grupo.length < 6) return;
      // de vuelta a su tamaño, sin salirse de la mancha
      let borde = new Set(grupo);
      const todo = new Set(grupo);
      for (let i = 0; i < k + 1; i++) {
        const sig = new Set();
        borde.forEach((p) => N4.forEach((d) => S.has(p + d) && !todo.has(p + d) && (todo.add(p + d), sig.add(p + d))));
        borde = sig;
      }
      todo.forEach((p) => tapado.add(p));
      gordos.push([...todo]);
    });
    return { gordos, finos: pts.filter((p) => !tapado.has(p)) };
  }
  // una mancha redonda → una o varias elipses que la cubren (se parte por el lado largo si no se parece a una elipse)
  function elipses(g, pts, hondo = 0) {
    const w = g.w;
    let sx = 0,
      sy = 0;
    pts.forEach((p) => ((sx += p % w), (sy += (p / w) | 0)));
    const cx = sx / pts.length,
      cy = sy / pts.length;
    let vx = 0,
      vy = 0,
      x0 = 1e9,
      x1 = -1e9,
      y0 = 1e9,
      y1 = -1e9;
    pts.forEach((p) => {
      const x = p % w,
        y = (p / w) | 0;
      vx += (x - cx) ** 2;
      vy += (y - cy) ** 2;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    });
    const rx = Math.max(1, 2 * Math.sqrt(vx / pts.length)),
      ry = Math.max(1, 2 * Math.sqrt(vy / pts.length)),
      lleno = pts.length / (Math.PI * rx * ry);
    if (lleno > 0.62 || hondo >= 3 || pts.length < 40) return [{ x: cx + 0.5, y: cy + 0.5, rx, ry }];
    const porX = x1 - x0 >= y1 - y0,
      corte = porX ? (x0 + x1) / 2 : (y0 + y1) / 2,
      a = pts.filter((p) => (porX ? p % w : (p / w) | 0) < corte),
      b = pts.filter((p) => (porX ? p % w : (p / w) | 0) >= corte);
    return (a.length ? elipses(g, a, hondo + 1) : []).concat(b.length ? elipses(g, b, hondo + 1) : []);
  }
  // la cáscara convexa de una mancha (para mandarle a la IA la forma de un bosque o un claro sin cada punto)
  function cascara(g, pts) {
    const w = g.w,
      P = [];
    // de cada fila, el punto de más a la izquierda y el de más a la derecha
    const filas = new Map();
    pts.forEach((p) => {
      const x = p % w,
        y = (p / w) | 0,
        f = filas.get(y);
      if (!f) filas.set(y, [x, x]);
      else (f[0] = Math.min(f[0], x)), (f[1] = Math.max(f[1], x));
    });
    filas.forEach(([a, b], y) => P.push([a, y], [b + 1, y + 1]));
    P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const abajo = [],
      arriba = [];
    for (const p of P) {
      while (abajo.length >= 2 && cruz(abajo[abajo.length - 2], abajo[abajo.length - 1], p) <= 0) abajo.pop();
      abajo.push(p);
    }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      while (arriba.length >= 2 && cruz(arriba[arriba.length - 2], arriba[arriba.length - 1], p) <= 0) arriba.pop();
      arriba.push(p);
    }
    return abajo.slice(0, -1).concat(arriba.slice(0, -1));
  }

  // ---------- de la hoja al mundo ----------
  // lo leído queda en coordenadas del mundo: la hoja va centrada en `centro`, con el ancho elegido en metros
  function motor() {
    const g = leerHoja(),
      ms = manchas(g),
      anchoM = +$("boAncho").value,
      s = (anchoM * 30) / g.w, // unidades del mundo por punto de la grilla
      x0 = centro[0] - (g.w * s) / 2,
      y0 = centro[1] - (g.h * s) / 2,
      aM = (p) => [Math.round(x0 + (p[0] + 0.5) * s), Math.round(y0 + (p[1] + 0.5) * s)];
    const L = { caminos: [], rios: [], lagos: [], bosques: [], claros: [], poner: [], avisos: [], g, s, x0, y0, papel: g.papel };
    let ruido = 0;
    ms.forEach((m) => {
      const A = m.pts.length;
      // (m se cambia abajo si el agua se parte en laguna y río)
      if (A < 4) return void ruido++;
      const q = m.clase;
      let xs0 = 1e9,
        xs1 = -1e9,
        ys0 = 1e9,
        ys1 = -1e9,
        sx = 0,
        sy = 0;
      m.pts.forEach((p) => {
        const x = p % g.w,
          y = (p / g.w) | 0;
        sx += x;
        sy += y;
        xs0 = Math.min(xs0, x);
        xs1 = Math.max(xs1, x);
        ys0 = Math.min(ys0, y);
        ys1 = Math.max(ys1, y);
      });
      const centroM = aM([sx / A, sy / A]),
        largo = Math.hypot(xs1 - xs0, ys1 - ys0),
        alargada = largo >= 10 && (largo * largo) / A >= 5,
        dentro = (x, y) => {
          const gx = Math.floor((x - x0) / s),
            gy = Math.floor((y - y0) / s);
          return gx >= 0 && gy >= 0 && gx < g.w && gy < g.h && g.id[gy * g.w + gx] === m.n;
        };
      if (q === "trazo" || q === "marron" || q === "agua") {
        // un marco alrededor de toda la hoja no es un camino (casi todo lo suyo está pegado a los bordes)
        const bw = g.w * 0.06,
          bh = g.h * 0.06;
        if (q === "trazo" && xs1 - xs0 > g.w * 0.9 && ys1 - ys0 > g.h * 0.9 && m.pts.filter((p) => { const x = p % g.w, y = (p / g.w) | 0; return x < bw || y < bh || x > g.w - bw || y > g.h - bh; }).length > A * 0.75) return;
        // el agua puede ser un río que llega a una laguna: lo gordo (lo que sobrevive a achicarla) es laguna, lo demás río
        if (q === "agua" && alargada) {
          const { gordos, finos } = separar(g, m.pts, 4);
          gordos.forEach((pts) => elipses(g, pts).forEach((e) => L.lagos.push({ x: Math.round(x0 + e.x * s), y: Math.round(y0 + e.y * s), rx: Math.round(Math.max(150, e.rx * s)), ry: Math.round(Math.max(100, e.ry * s)) })));
          if (gordos.length) m = { n: m.n, clase: q, pts: finos };
          if (m.pts.length < 6) return;
        }
        if (alargada) {
          const { lineas, grueso } = trazos(g, m);
          lineas.forEach((ln) => {
            if (ln.length < 2) return;
            const p = ln.map(aM);
            if (q === "agua") L.rios.push({ p, w: Math.round(Math.max(160, Math.min(900, grueso * s))) });
            else L.caminos.push({ p, w: Math.round(Math.max(110, Math.min(260, grueso * s))), tipo: "tierra", borde: "pasto" });
          });
          return;
        }
        if (q === "agua") return elipses(g, m.pts).forEach((e) => L.lagos.push({ x: Math.round(x0 + e.x * s), y: Math.round(y0 + e.y * s), rx: Math.round(Math.max(150, e.rx * s)), ry: Math.round(Math.max(100, e.ry * s)) }));
        if (q === "marron") return L.claros.push({ dentro, p: cascara(g, m.pts).map(aM) });
        // un relleno gris o negro: rocas
        if (A <= 30) return L.poner.push({ id: "roca", x: centroM[0], y: centroM[1], o: { esc: 1 + Math.min(1, A / 30) } });
        return L.bosques.push({ dentro, p: cascara(g, m.pts).map(aM), mezcla: [["roca", 100]], paso: 150 });
      }
      if (q === "bosque") {
        if (A <= 24) return L.poner.push({ id: A > 12 ? "roble" : "pino", x: centroM[0], y: centroM[1], o: { sem: m.n % 20 } });
        return L.bosques.push({ dentro, p: cascara(g, m.pts).map(aM) });
      }
      if (q === "casa") {
        if (A <= 220) return L.poner.push({ id: "casaNordica", x: centroM[0], y: centroM[1], o: { v: m.n % 6, sem: m.n, s: 0.9 } });
        return L.claros.push({ dentro, p: cascara(g, m.pts).map(aM), casas: true, c: centroM });
      }
      if (q === "claro") return L.claros.push({ dentro, p: cascara(g, m.pts).map(aM) });
      if (q === "fuego") return L.poner.push({ id: "fogonOlla", x: centroM[0], y: centroM[1], o: {} });
      if (q === "runa") return L.poner.push({ id: "piedraSusurro", x: centroM[0], y: centroM[1], o: { viva: true } });
    });
    unirCaminos(L);
    // lo que no cumple la hoja
    if (Math.min(hoja.ancho, hoja.alto) < 400) L.avisos.push("ed.bo_av_chica");
    if (g.papel < 0.35) L.avisos.push("ed.bo_av_papel");
    if (ruido > 160) L.avisos.push("ed.bo_av_ruido");
    if (!L.caminos.length && !L.rios.length && !L.lagos.length && !L.bosques.length && !L.claros.length && !L.poner.length) L.avisos.push("ed.bo_av_nada");
    return L;
  }
  // la punta de un camino que cae cerca de otro se pega a él (así se juntan, también con los caminos que ya hay)
  function unirCaminos(L) {
    const todos = L.caminos.map((c) => c.p).concat(W.CAMINOS.map((c) => c.p));
    const masCerca = (q, propio) => {
      let mejor = null,
        dm = 1e9;
      todos.forEach((p) => {
        if (p === propio) return;
        for (let i = 0; i < p.length - 1; i++) {
          const [ax, ay] = p[i],
            [bx, by] = p[i + 1],
            dx = bx - ax,
            dy = by - ay,
            k = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / (dx * dx + dy * dy || 1))),
            x = ax + dx * k,
            y = ay + dy * k,
            d = Math.hypot(x - q[0], y - q[1]);
          if (d < dm) (dm = d), (mejor = [Math.round(x), Math.round(y)]);
        }
      });
      return { mejor, dm };
    };
    L.caminos.forEach((c) => {
      [0, c.p.length - 1].forEach((i) => {
        const { mejor, dm } = masCerca(c.p[i], c.p);
        if (mejor && dm > 1 && dm < Math.max(220, c.w * 2)) c.p[i] = mejor;
      });
    });
  }

  // ---------- de lo leído a los cambios del editor ----------
  function azar(sem) {
    let a = sem >>> 0 || 1;
    return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const elegirDe = (l, r) => {
    const tot = l.reduce((s, q) => s + q[1], 0);
    let v = r() * tot;
    for (const [id, p] of l) if ((v -= p) <= 0) return id;
    return l[0][0];
  };
  const enPoligono = (p, x, y) => {
    let d = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i],
        [xj, yj] = p[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) d = !d;
    }
    return d;
  };
  function armar(L) {
    const r = azar(hoja ? hoja.sem : 7),
      dens = +$("boDensidad").value,
      ops = { poner: [], caminos: L.caminos.slice(), rios: L.rios.slice(), lagos: L.lagos.slice(), quitar: [] };
    const caja = cajaHoja();
    // ¿cae sobre agua o camino (lo nuevo o lo que ya hay)?
    const libre = (x, y, m) => {
      for (const c of ops.caminos.concat(W.CAMINOS)) if (W.distLinea(x, y, c.p) < c.w / 2 + m) return false;
      for (const rio of ops.rios.concat(W.RIOS.filter((q) => !q.seco))) if (W.distLinea(x, y, rio.p) < rio.w / 2 + m) return false;
      for (const l of ops.lagos) if (Math.hypot((x - l.x) / (l.rx + m), (y - l.y) / (l.ry + m)) < 1) return false;
      for (const l of W.LAGOS) if (!l.seco && Math.hypot((x - l.p[0]) / (l.rx + m), (y - l.p[1]) / (l.ry + m)) < 1) return false;
      return true;
    };
    const dentroDe = (a) => a.dentro || ((x, y) => enPoligono(a.p, x, y));
    // lo puesto de a uno (casas, fogatas, piedras, árboles y rocas sueltas)
    L.poner.forEach((a) => {
      if (!ASSETS.LISTA[a.id]) return;
      if (a.id !== "casaNordica" && !libre(a.x, a.y, 20)) return;
      ops.poner.push({ id: a.id, x: a.x, y: a.y, o: Object.assign({}, a.o) });
    });
    // los pueblos: casas en una grilla adentro de la mancha roja, mirando al camino más cercano
    L.claros.filter((a) => a.casas).forEach((a) => {
      const f = dentroDe(a);
      let n = 0;
      for (let y = caja[1] + 210; y < caja[3]; y += 420)
        for (let x = caja[0] + 210 + ((y / 420) % 2) * 120; x < caja[2]; x += 460) {
          const jx = x + (r() - 0.5) * 80,
            jy = y + (r() - 0.5) * 60;
          if (!f(jx, jy) || !libre(jx, jy, 120)) continue;
          ops.poner.push({ id: "casaNordica", x: Math.round(jx), y: Math.round(jy), o: { v: Math.floor(r() * 6), sem: Math.floor(r() * 1000), s: 0.82 + r() * 0.16, entra: n++ % 4 === 1 } });
        }
      if (!n && a.c) ops.poner.push({ id: "casaNordica", x: a.c[0], y: a.c[1], o: { v: Math.floor(r() * 6), sem: Math.floor(r() * 1000), s: 0.9 } });
    });
    ops.poner.filter((a) => a.id === "casaNordica").forEach((a) => {
      // el frente (w) mira al camino más cercano si hay uno a menos de 20 m
      let mejor = null,
        dm = 600;
      ops.caminos.concat(W.CAMINOS).forEach((c) => {
        for (let i = 0; i < c.p.length - 1; i++) {
          const [ax, ay] = c.p[i],
            [bx, by] = c.p[i + 1],
            dx = bx - ax,
            dy = by - ay,
            k = Math.max(0, Math.min(1, ((a.x - ax) * dx + (a.y - ay) * dy) / (dx * dx + dy * dy || 1))),
            px = ax + dx * k,
            py = ay + dy * k,
            d = Math.hypot(px - a.x, py - a.y);
          if (d < dm) (dm = d), (mejor = [px - a.x, py - a.y]);
        }
      });
      if (mejor) a.o.giro = Math.round((Math.atan2(-mejor[0], mejor[1]) * 180) / Math.PI / 5) * 5;
    });
    // los bosques (y los rellenos de rocas): de a uno en una grilla movida, sin caer en caminos ni agua
    L.bosques.forEach((a) => {
      const f = dentroDe(a),
        paso = (a.paso || 140) / Math.sqrt(dens),
        mz = a.mezcla || MEZCLA;
      for (let y = caja[1] + paso / 2; y < caja[3]; y += paso)
        for (let x = caja[0] + paso / 2; x < caja[2]; x += paso) {
          const jx = x + (r() - 0.5) * paso * 0.8,
            jy = y + (r() - 0.5) * paso * 0.8;
          if (!f(jx, jy) || !libre(jx, jy, 30)) continue;
          if (ops.poner.some((q) => q.id === "casaNordica" && Math.abs(q.x - jx) < 220 && Math.abs(q.y - jy) < 160)) continue;
          const id = elegirDe(mz, r);
          ops.poner.push({ id, x: Math.round(jx), y: Math.round(jy), o: { sem: Math.floor(r() * 20), esc: Math.round((0.85 + r() * 0.3) * 100) / 100, esp: r() < 0.5 } });
        }
    });
    // lo que se saca: lo natural en los claros y debajo de lo nuevo, y (si se pide) todo lo natural fuera del bosque
    const despejar = $("boDespejar").checked,
      enBosque = (x, y) => L.bosques.some((a) => !a.mezcla && dentroDe(a)(x, y)),
      nuevos = ops.poner.filter((a) => a.id === "casaNordica");
    E.cosasEn(caja[0], caja[1], caja[2], caja[3]).forEach((o) => {
      if (o.historia || o.agregado || !(o.natural || o.id === "tocon")) return;
      const fuera = despejar && !enBosque(o.x, o.y),
        enClaro = L.claros.some((a) => dentroDe(a)(o.x, o.y)),
        tapa = nuevos.some((q) => Math.abs(q.x - o.x) < 220 && Math.abs(q.y - o.y) < 160) || !libre(o.x, o.y, 10);
      if (fuera || enClaro || tapa) ops.quitar.push({ id: o.id, x: o.x, y: o.y });
    });
    ops.poner = ops.poner.slice(0, 2500);
    return ops;
  }
  const cajaHoja = () => {
    if (!hoja || !centro) return [0, 0, 0, 0];
    const ancho = +$("boAncho").value * 30,
      alto = (ancho * hoja.alto) / hoja.ancho;
    return [centro[0] - ancho / 2, centro[1] - alto / 2, centro[0] + ancho / 2, centro[1] + alto / 2];
  };

  // ---------- el panel ----------
  function pintarChequeo() {
    const ul = $("boChequeo");
    ul.innerHTML = "";
    if (!lectura) return;
    const fila = (ok, txt) => {
      const li = document.createElement("li");
      li.className = ok ? "ok" : "mal";
      li.textContent = (ok ? "✓ " : "✗ ") + txt;
      ul.appendChild(li);
    };
    const av = lectura.avisos || [];
    fila(!av.includes("ed.bo_av_chica"), t(av.includes("ed.bo_av_chica") ? "ed.bo_av_chica" : "ed.bo_ok_tam", [hoja.ancho, hoja.alto]));
    fila(!av.includes("ed.bo_av_papel"), t(av.includes("ed.bo_av_papel") ? "ed.bo_av_papel" : "ed.bo_ok_papel", [Math.round((lectura.papel || 0) * 100)]));
    if (av.includes("ed.bo_av_ruido")) fila(false, t("ed.bo_av_ruido"));
    fila(!av.includes("ed.bo_av_nada"), t(av.includes("ed.bo_av_nada") ? "ed.bo_av_nada" : "ed.bo_ok_algo"));
  }
  function resumenDe(p) {
    const n = (id) => p.poner.filter((a) => a.id === id).length,
      arboles = p.poner.filter((a) => (ASSETS.LISTA[a.id] || {}).grupo === "naturaleza" && a.id !== "roca").length;
    return t("ed.bo_resumen", [p.caminos.length, p.rios.length, p.lagos.length, arboles, n("roca"), n("casaNordica"), p.poner.length - arboles - n("roca") - n("casaNordica"), p.quitar.length]);
  }
  function pintarResumen() {
    if (!propuesta) return $("boPropuesta").classList.add("oculto");
    $("boResumen").textContent = resumenDe(propuesta);
    $("boPropuesta").classList.remove("oculto");
  }
  // la hoja chica con lo que se leyó encima (cada clase con su color)
  function pintarVista() {
    const cv = $("boVista"),
      c = cv.getContext("2d");
    c.clearRect(0, 0, cv.width, cv.height);
    if (!hoja) return;
    const k = Math.min(cv.width / hoja.ancho, cv.height / hoja.alto),
      w = hoja.ancho * k,
      h = hoja.alto * k,
      ox = (cv.width - w) / 2,
      oy = (cv.height - h) / 2;
    c.drawImage(hoja.img, ox, oy, w, h);
    if (!lectura || !lectura.g || !$("boVerLeido").checked) return;
    const g = lectura.g,
      kk = w / g.w;
    c.fillStyle = "rgba(242,236,236,0.72)";
    c.fillRect(ox, oy, w, h);
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const q = g.cl[y * g.w + x];
        if (!q) continue;
        c.fillStyle = COLOR[q];
        c.fillRect(ox + x * kk, oy + y * kk, Math.ceil(kk), Math.ceil(kk));
      }
  }
  function regenerar() {
    if (!hoja) return;
    try {
      lectura = motor();
      propuesta = armar(lectura);
    } catch (e) {
      console.error(e);
      lectura = { avisos: ["ed.bo_av_nada"] };
      propuesta = null;
    }
    pintarChequeo();
    pintarVista();
    pintarResumen();
    E.pedir();
  }
  let espera = 0;
  const pronto = () => (clearTimeout(espera), (espera = setTimeout(regenerar, 160)));
  function cargar(archivo) {
    if (!archivo || !/^image\//.test(archivo.type)) return E.avisar(t("ed.bo_no_imagen"));
    if (archivo.size > 12 * 1024 * 1024) return E.avisar(t("ed.bo_muy_grande"));
    const url = URL.createObjectURL(archivo),
      img = new Image();
    img.onload = () => {
      // la semilla sale del tamaño y del nombre: el mismo boceto da siempre el mismo bosque
      let sem = archivo.size;
      for (const ch of archivo.name) sem = (sem * 31 + ch.charCodeAt(0)) >>> 0;
      hoja = { img, ancho: img.naturalWidth, alto: img.naturalHeight, sem };
      centro = [Math.round(E.cam.x), Math.round(E.cam.y)];
      $("boVacio").classList.add("oculto");
      regenerar();
      E.usar("boceto");
    };
    img.onerror = () => E.avisar(t("ed.bo_no_imagen"));
    img.src = url;
  }
  $("boArchivo").addEventListener("change", (e) => cargar(e.target.files[0]));
  $("boElegir").onclick = () => $("boArchivo").click();
  panel.addEventListener("dragover", (e) => e.preventDefault());
  panel.addEventListener("drop", (e) => {
    e.preventDefault();
    cargar(e.dataTransfer.files[0]);
  });
  addEventListener("paste", (e) => {
    if (!abierta()) return;
    const it = [...(e.clipboardData || {}).items || []].find((i) => i.type.startsWith("image/"));
    if (it) cargar(it.getAsFile());
  });
  ["boAncho", "boDensidad"].forEach((id) =>
    $(id).addEventListener("input", () => {
      $(id + "V").textContent = id === "boAncho" ? $(id).value + " m" : (+$(id).value).toFixed(1);
      if (!lectura || !lectura.deIA) pronto();
      else (propuesta = armar(lectura)), pintarResumen(), E.pedir();
    }),
  );
  $("boDespejar").addEventListener("change", () => (lectura && lectura.deIA ? ((propuesta = armar(lectura)), pintarResumen(), E.pedir()) : pronto()));
  $("boVerLeido").addEventListener("change", pintarVista);
  $("boCentrar").onclick = () => {
    centro = [Math.round(E.cam.x), Math.round(E.cam.y)];
    if (lectura && lectura.deIA) return pintarIA(t("ed.bo_ia_movida"));
    regenerar();
  };
  $("boAplicar").onclick = () => {
    if (!propuesta) return;
    E.aplicar(propuesta, { sinElegir: true });
    E.avisar(t("ed.bo_aplicado"));
    propuesta = null;
    pintarResumen();
  };
  $("boDescartar").onclick = () => {
    propuesta = null;
    pintarResumen();
    E.pedir();
  };
  $("boLeerDeNuevo").onclick = () => regenerar();

  // ---------- con IA ----------
  function pintarIA(msg) {
    $("boIA").classList.toggle("activo", ia);
    $("boIA").textContent = t(ia ? "ed.bo_ia_on" : "ed.bo_ia_off");
    $("boFilaIA").classList.toggle("oculto", !ia);
    const el = window.EDITOR_IA ? EDITOR_IA.paraTarea("boceto") : null;
    $("boIAQuien").textContent = msg || (!el ? t("ed.bo_ia_sin") : t("ed.bo_ia_con", [el.nombre, el.modelo]));
  }
  $("boIA").onclick = () => {
    ia = !ia;
    pintarIA();
  };
  $("boPedido").addEventListener("keydown", (e) => e.stopPropagation());
  const SISTEMA = [
    "You turn a hand-drawn sketch map into level data for Eldervald, the forest world of Eromash, a 2.5D Norse adventure seen from above.",
    "Legend of the sketch: blue = water (a line is a river, a filled blob is a pond or lake); black, grey pencil or brown lines = dirt roads; green = forest (a single green dot is one tree); red = houses (a small square is one house, a big red area is a village); yellow = a clearing (open ground, remove trees); orange dot = campfire; violet dot = rune stone; grey or black filled area = rocks. White paper is open meadow.",
    "World units: 30 units are about 1 meter, x grows to the east and y to the south. The sheet covers the world rectangle given below: the image's left edge is x0, its top edge is y0.",
    "A rule-based engine already read the sketch; its reading comes as JSON. Use it as the base: keep what is right, fix what it misread (writing, shading, stains, colors read as the wrong thing, broken lines that should be one road) and add what the drawing clearly shows but the engine missed.",
    "Then make it a real place with a few fitting named assets from the catalog (a well in a village, fences around fields, carts, a signpost where roads meet, a dock on a lake), at most 150 extra objects. Do not place single trees: describe forests as areas and the game fills them.",
    "Answer in the user's language: first two or three sentences for the user, then exactly one JSON object in a ```json block:",
    '{"explicacion": string, "caminos": [{"p": [[x, y], ...], "w": 110 to 260, "tipo": "tierra" | "adoquin" | "ladrillo"}], "rios": [{"p": [[x, y], ...], "w": 160 to 900}], "lagos": [{"x": number, "y": number, "rx": number, "ry": number}], "bosques": [{"p": [[x, y], ...] polygon, "rocas": boolean}], "claros": [{"p": [[x, y], ...] polygon, "pueblo": boolean}], "poner": [{"id": string, "x": number, "y": number, "o": object}]}',
    "Houses are id casaNordica with o: { v: 0 to 5, sem: integer, giro: degrees so the front faces the nearest road }. Use only ids from the catalog.",
  ].join("\n");
  function lecturaParaIA(L) {
    const cas = cajaHoja();
    return {
      hoja: { x0: Math.round(cas[0]), y0: Math.round(cas[1]), x1: Math.round(cas[2]), y1: Math.round(cas[3]), metros: +$("boAncho").value },
      caminos: L.caminos.map((c) => ({ p: c.p, w: c.w })),
      rios: L.rios,
      lagos: L.lagos,
      bosques: L.bosques.map((b) => ({ p: b.p, rocas: !!b.mezcla })),
      claros: L.claros.map((c) => ({ p: c.p, pueblo: !!c.casas })),
      poner: L.poner,
    };
  }
  function contenido(quien, texto) {
    // la hoja como JPEG de a lo sumo 1200 puntos
    const k = Math.min(1, 1200 / Math.max(hoja.ancho, hoja.alto)),
      cv = document.createElement("canvas");
    cv.width = Math.round(hoja.ancho * k);
    cv.height = Math.round(hoja.alto * k);
    const c = cv.getContext("2d");
    c.fillStyle = "#FFFFFF";
    c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(hoja.img, 0, 0, cv.width, cv.height);
    const url = cv.toDataURL("image/jpeg", 0.85),
      datos = url.slice(url.indexOf(",") + 1);
    if (quien === "chatgpt") return [{ type: "image_url", image_url: { url } }, { type: "text", text: texto }];
    return [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: datos } }, { type: "text", text: texto }];
  }
  function leerIA(txt) {
    const m = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
    let js = null;
    try {
      js = JSON.parse(m ? m[1] : txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    } catch (e) {}
    if (!js) return null;
    const num = (v) => isFinite(+v),
      linea = (p) => Array.isArray(p) && p.length >= 2 && p.every((q) => Array.isArray(q) && num(q[0]) && num(q[1])),
      poli = (p) => Array.isArray(p) && p.length >= 3 && p.every((q) => Array.isArray(q) && num(q[0]) && num(q[1])),
      arr = (v) => (Array.isArray(v) ? v : []);
    return {
      texto: (m ? txt.replace(m[0], "") : txt.slice(0, txt.indexOf("{"))).trim() || js.explicacion || "",
      L: {
        deIA: true,
        caminos: arr(js.caminos).filter((c) => c && linea(c.p)).slice(0, 40).map((c) => ({ p: c.p.map((q) => [+q[0], +q[1]]), w: Math.max(60, Math.min(300, +c.w || 110)), tipo: ["tierra", "adoquin", "ladrillo"].includes(c.tipo) ? c.tipo : "tierra", borde: "pasto" })),
        rios: arr(js.rios).filter((c) => c && linea(c.p)).slice(0, 20).map((c) => ({ p: c.p.map((q) => [+q[0], +q[1]]), w: Math.max(80, Math.min(900, +c.w || 300)) })),
        lagos: arr(js.lagos).filter((l) => l && num(l.x) && num(l.y)).slice(0, 30).map((l) => ({ x: +l.x, y: +l.y, rx: Math.max(150, Math.min(2400, +l.rx || 500)), ry: Math.max(100, Math.min(1800, +l.ry || 350)) })),
        bosques: arr(js.bosques).filter((b) => b && poli(b.p)).slice(0, 40).map((b) => Object.assign({ p: b.p.map((q) => [+q[0], +q[1]]) }, b.rocas ? { mezcla: [["roca", 100]], paso: 150 } : {})),
        claros: arr(js.claros).filter((b) => b && poli(b.p)).slice(0, 40).map((b) => ({ p: b.p.map((q) => [+q[0], +q[1]]), casas: !!b.pueblo })),
        poner: arr(js.poner).filter((a) => a && ASSETS.LISTA[a.id] && num(a.x) && num(a.y)).slice(0, 400).map((a) => ({ id: a.id, x: +a.x, y: +a.y, o: a.o && typeof a.o === "object" ? a.o : {} })),
        avisos: [],
      },
    };
  }
  function textoIA(base) {
    const cat = EDITOR_IA.catalogo ? EDITOR_IA.catalogo() : "";
    return (
      (($("boPedido").value || "").trim() ? "Extra request from the user: " + $("boPedido").value.trim() + "\n\n" : "") +
      "World rectangle of the sheet and the engine's reading:\n" + JSON.stringify(lecturaParaIA(base)) + "\n\nAsset catalog:\n" + cat
    );
  }
  async function generarIA() {
    if (!hoja || !lectura || pensando) return;
    const el = window.EDITOR_IA && EDITOR_IA.paraTarea("boceto");
    if (!el) return pintarIA(), E.avisar(t("ed.bo_ia_falta"));
    pensando = true;
    $("boGenerar").disabled = true;
    pintarIA(t("ed.bo_ia_pensando"));
    const base = lectura.deIA ? lectura.base : lectura,
      texto = textoIA(base);
    try {
      const { txt } = await EDITOR_IA.llamarTarea("boceto", (q) => [{ role: "user", content: contenido(q, texto) }], SISTEMA, (n) => pintarIA(t("ed.bo_ia_pensando_con", [n])));
      const r = leerIA(txt);
      if (!r) throw new Error(t("ed.ia_sin_json"));
      r.L.base = base;
      lectura = r.L;
      propuesta = armar(lectura);
      pintarResumen();
      pintarIA(r.texto || t("ed.bo_ia_listo"));
      E.pedir();
    } catch (e) {
      pintarIA(t("ed.ia_error", [String(e.message || e)]));
    }
    pensando = false;
    $("boGenerar").disabled = false;
  }
  $("boGenerar").onclick = generarIA;

  // ---------- con todas las IA a la vez: cada una arma su versión y se eligen una, dos o todas (cada una en su capa) ----------
  let varias = null;
  async function generarTodas() {
    if (!hoja || !lectura || pensando) return;
    if (!window.EDITOR_IA || EDITOR_IA.conClave().length < 2) return E.avisar(t("ed.ia_todas_falta"));
    const base = lectura.deIA ? lectura.base : lectura,
      texto = textoIA(base),
      yo = {};
    pensando = true;
    $("boTodas").disabled = $("boGenerar").disabled = true;
    pintarIA(t("ed.ia_todas_pensando", [EDITOR_IA.conClave().map((q) => EDITOR_IA.NOMBRES[q]).join(", ")]));
    const { res, listo } = EDITOR_IA.pedirATodas(
      (q) => [{ role: "user", content: contenido(q, texto) }],
      SISTEMA,
      (txt) => {
        const r = leerIA(txt);
        if (!r) return null;
        r.L.base = base;
        return { ops: armar(r.L), texto: r.texto };
      },
      () => varias === yo && (pintarVarias(), E.pedir()),
    );
    yo.res = res;
    varias = yo;
    propuesta = null;
    pintarResumen();
    pintarVarias();
    $("boVarias").scrollIntoView({ block: "nearest" });
    await listo;
    pensando = false;
    $("boTodas").disabled = $("boGenerar").disabled = false;
    pintarIA(t("ed.bo_todas_listo"));
  }
  function pintarVarias() {
    $("boVarias").classList.toggle("oculto", !varias);
    if (varias) EDITOR_IA.pintarLista($("boVariasLista"), varias.res, pintarUsar, resumenDe);
  }
  function pintarUsar() {
    const n = varias ? varias.res.filter((r) => r.usar && r.ops).length : 0;
    $("boVariasAplicar").disabled = !n;
    $("boVariasAplicar").textContent = t("ed.ia_todas_aplicar", [n]);
  }
  $("boTodas").onclick = generarTodas;
  $("boVariasDescartar").onclick = () => {
    varias = null;
    pintarVarias();
    E.pedir();
  };
  $("boVariasAplicar").onclick = () => {
    const elegidas = varias ? varias.res.filter((r) => r.usar && r.ops) : [];
    if (!elegidas.length) return;
    EDITOR_IA.aplicarEnCapas(elegidas, ($("boPedido").value || "").trim() || t("ed.bo_capa"));
    E.avisar(t("ed.ia_todas_aplicado", [elegidas.map((r) => r.nombre).join(", ")]));
    varias = null;
    pintarVarias();
    if (window.EDITOR_CAPAS) EDITOR_CAPAS.verPestana("capas");
  };

  // ---------- en el mapa: la hoja apoyada en el piso y lo que se va a hacer ----------
  function dibujar(c, cam, V, tt) {
    if (!abierta() || !hoja || !centro) return;
    const [x0, y0, x1, y1] = cajaHoja(),
      a = V(x0, y0),
      b = V(x1, y0),
      d = V(x0, y1);
    c.save();
    c.globalAlpha = 0.28;
    c.transform((b[0] - a[0]) / hoja.ancho, (b[1] - a[1]) / hoja.ancho, (d[0] - a[0]) / hoja.alto, (d[1] - a[1]) / hoja.alto, a[0], a[1]);
    c.drawImage(hoja.img, 0, 0);
    c.restore();
    c.save();
    c.strokeStyle = "#FFD98A";
    c.lineWidth = 2.5 / cam.z;
    c.setLineDash([14 / cam.z, 8 / cam.z]);
    c.beginPath();
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], i) => (i ? c.lineTo(...V(x, y)) : c.moveTo(...V(x, y))));
    c.closePath();
    c.stroke();
    c.restore();
    if (varias) EDITOR_IA.dibujarRes(c, cam, V, tt, varias.res);
    if (!propuesta) return;
    const linea = (p, col, ancho) => {
      c.strokeStyle = col;
      c.lineWidth = ancho;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      p.forEach(([x, y], i) => (i ? c.lineTo(...V(x, y)) : c.moveTo(...V(x, y))));
      c.stroke();
    };
    c.save();
    c.globalAlpha = 0.55;
    propuesta.rios.forEach((rr) => linea(rr.p, "#4A78D0", rr.w));
    propuesta.lagos.forEach((l) => {
      c.fillStyle = "#4A78D0";
      c.beginPath();
      for (let i = 0; i <= 24; i++) {
        const an = (i / 24) * Math.PI * 2;
        c.lineTo(...V(l.x + Math.cos(an) * l.rx, l.y + Math.sin(an) * l.ry));
      }
      c.fill();
    });
    propuesta.caminos.forEach((cm) => linea(cm.p, "#C9A45A", cm.w));
    c.restore();
    E.fantasmas(c, propuesta.poner, tt, 0.6);
    c.save();
    c.globalAlpha = 0.45;
    c.strokeStyle = "#C8402D";
    c.lineWidth = 1.5 / cam.z;
    propuesta.quitar.slice(0, 800).forEach((q) => {
      const [x, y] = V(q.x, q.y),
        r = 5 / cam.z;
      c.beginPath();
      c.moveTo(x - r, y - r);
      c.lineTo(x + r, y + r);
      c.moveTo(x + r, y - r);
      c.lineTo(x - r, y + r);
      c.stroke();
    });
    c.restore();
  }

  function abierta() {
    return !panel.classList.contains("oculto");
  }
  function abrir() {
    panel.classList.remove("oculto");
    $("hBoceto").classList.add("activo");
    pintarIA();
    E.usar("boceto");
    E.pedir();
  }
  function cerrar() {
    panel.classList.add("oculto");
    $("hBoceto").classList.remove("activo");
    E.pedir();
  }
  const alternar = () => (abierta() ? cerrar() : abrir());
  $("boCerrar").onclick = cerrar;
  $("hBoceto").onclick = alternar;
  function tecla(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === "u" || e.key === "U") return alternar(), true;
    return false;
  }
  $("boAnchoV").textContent = $("boAncho").value + " m";
  $("boDensidadV").textContent = (+$("boDensidad").value).toFixed(1);
  // para las pruebas: leer una imagen ya cargada sin pasar por el archivo
  const probar = (img, sem = 7) => {
    hoja = { img, ancho: img.naturalWidth || img.width, alto: img.naturalHeight || img.height, sem };
    centro = [Math.round(E.cam.x), Math.round(E.cam.y)];
    $("boVacio").classList.add("oculto");
    regenerar();
    return { lectura, propuesta };
  };
  return { abrir, cerrar, alternar, abierta, tecla, dibujar, probar, claseDe };
})();
