import { useEffect, useRef } from 'react';
import { socket } from '../socket';

const W = 800, H = 600;

function hexToRgba(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

function floodFill(ctx, startX, startY, fillColorHex) {
  const x0 = Math.round(Math.max(0, Math.min(W - 1, startX)));
  const y0 = Math.round(Math.max(0, Math.min(H - 1, startY)));
  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;

  const targetIdx = (y0 * W + x0) * 4;
  const tr = data[targetIdx], tg = data[targetIdx + 1], tb = data[targetIdx + 2], ta = data[targetIdx + 3];
  const [fr, fg, fb, fa] = hexToRgba(fillColorHex);

  if (Math.abs(tr - fr) < 5 && Math.abs(tg - fg) < 5 && Math.abs(tb - fb) < 5 && Math.abs(ta - fa) < 5) {
    return;
  }

  const match = (idx) => {
    return (
      Math.abs(data[idx] - tr) <= 24 &&
      Math.abs(data[idx + 1] - tg) <= 24 &&
      Math.abs(data[idx + 2] - tb) <= 24 &&
      Math.abs(data[idx + 3] - ta) <= 24
    );
  };

  const stack = [x0, y0];
  const visited = new Uint8Array(W * H);

  while (stack.length > 0) {
    const cy = stack.pop();
    const cx = stack.pop();

    if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
    const pixelPos = cy * W + cx;
    if (visited[pixelPos]) continue;
    visited[pixelPos] = 1;

    const idx = pixelPos * 4;
    if (!match(idx)) continue;

    data[idx] = fr;
    data[idx + 1] = fg;
    data[idx + 2] = fb;
    data[idx + 3] = fa;

    stack.push(cx + 1, cy);
    stack.push(cx - 1, cy);
    stack.push(cx, cy + 1);
    stack.push(cx, cy - 1);
  }

  ctx.putImageData(imgData, 0, 0);
}

function paintStroke(ctx, s) {
  if (s.type === 'fill') {
    floodFill(ctx, s.x * W, s.y * H, s.color);
    return;
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size;
  const pts = s.points;
  if (!pts || pts.length === 0) return;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x * W, pts[0].y * H, s.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x * W, pts[0].y * H);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * W, pts[i].y * H);
  ctx.stroke();
}

export default function Canvas({ canDraw, tool, strokes }) {
  const ref = useRef(null);
  const cur = useRef(null);
  const down = useRef(false);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  const ctx = () => ref.current?.getContext('2d', { willReadFrequently: true });
  const wipe = () => {
    const c = ctx();
    if (!c) return;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
  };
  const redraw = (list) => {
    wipe();
    const c = ctx();
    if (!c) return;
    list.forEach((s) => paintStroke(c, s));
  };

  useEffect(() => {
    cur.current = null;
    redraw(strokes || []);
  }, [strokes]);

  useEffect(() => {
    const onData = (d) => {
      const c = ctx();
      if (!c) return;
      if (d.type === 'fill') {
        floodFill(c, d.x * W, d.y * H, d.color);
      } else if (d.type === 'start') {
        cur.current = { color: d.color, size: d.size, points: [{ x: d.x, y: d.y }] };
        paintStroke(c, cur.current);
      } else if (d.type === 'move' && cur.current) {
        const pts = cur.current.points;
        pts.push({ x: d.x, y: d.y });
        paintStroke(c, { ...cur.current, points: pts.slice(-2) });
      } else if (d.type === 'end') {
        cur.current = null;
      }
    };
    const onClear = () => {
      cur.current = null;
      wipe();
    };
    const onRedraw = ({ strokes: list }) => {
      cur.current = null;
      redraw(list);
    };

    socket.on('draw_data', onData);
    socket.on('canvas_clear', onClear);
    socket.on('canvas_redraw', onRedraw);
    return () => {
      socket.off('draw_data', onData);
      socket.off('canvas_clear', onClear);
      socket.off('canvas_redraw', onRedraw);
    };
  }, []);

  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const onDown = (e) => {
    if (!canDraw) return;
    ref.current.setPointerCapture(e.pointerId);
    const p = pos(e), t = toolRef.current;

    if (t.mode === 'fill') {
      const color = t.color;
      floodFill(ctx(), p.x * W, p.y * H, color);
      socket.emit('draw_fill', { x: p.x, y: p.y, color });
      return;
    }

    down.current = true;
    const isEraser = t.mode === 'eraser';
    const color = isEraser ? '#ffffff' : t.color;
    const size = isEraser ? t.size * 2.5 : t.size;
    cur.current = { color, size, points: [p] };
    paintStroke(ctx(), cur.current);
    socket.emit('draw_start', { ...p, color, size });
  };

  const onMove = (e) => {
    if (!down.current || !cur.current) return;
    const p = pos(e);
    const last = cur.current.points.at(-1);
    if (Math.hypot(p.x - last.x, p.y - last.y) < 0.002) return;
    cur.current.points.push(p);
    paintStroke(ctx(), { ...cur.current, points: cur.current.points.slice(-2) });
    socket.emit('draw_move', p);
  };

  const onUp = () => {
    if (!down.current) return;
    down.current = false;
    cur.current = null;
    socket.emit('draw_end');
  };

  const getCursorClass = () => {
    if (!canDraw) return '';
    if (tool.mode === 'eraser') return 'cursor-eraser';
    if (tool.mode === 'fill') return 'cursor-bucket';
    return 'cursor-pen';
  };

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      className={`canvas ${canDraw ? 'drawable' : ''} ${getCursorClass()}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
