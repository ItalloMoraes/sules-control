<script setup lang="ts">
// Skill ambient-section-particles: canvas limitado à seção (pai), modo "recycle",
// um único loop rAF, pausa fora da tela / aba oculta, vento + oscilação + repulsão leve do ponteiro.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  density?: number; maxCount?: number; gravity?: number; wind?: number
  sway?: number; pointerRadius?: number; maxDpr?: number; links?: number
}>(), { density: 0.00004, maxCount: 60, gravity: -10, wind: 2, sway: 14, pointerRadius: 110, maxDpr: 2, links: 0 })

type P = { x: number; y: number; r: number; v: number; ph: number; op: number; ox: number; oy: number }
const canvas = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let host: HTMLElement | null = null
let io: IntersectionObserver | null = null, ro: ResizeObserver | null = null
let mq: MediaQueryList | null = null
let ps: P[] = [], raf = 0, last = 0, w = 0, h = 0, visible = false, rgb = '226,178,74'
let ptr: { x: number; y: number } | null = null
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function seed() {
  let n = Math.min(props.maxCount, Math.round(w * h * props.density))
  if (w < 480) n = Math.min(n, 24)              // limite para celular
  if (mq?.matches) n = Math.round(n / 2)        // composição estática, mais esparsa
  ps = Array.from({ length: n }, () => ({
    x: rnd(0, w), y: rnd(0, h), r: rnd(1, 3.2), v: rnd(6, 16), ph: rnd(0, 6.28), op: rnd(0.18, 0.55), ox: 0, oy: 0,
  }))
}
function color() {
  if (!host) return
  const c = getComputedStyle(document.documentElement).getPropertyValue('--c-gold').trim()
  if (c) rgb = c.split(/\s+/).join(',')
}
function draw(t: number) {
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  const pts = ps.map(p => ({ x: p.x + Math.sin(t / 1250 + p.ph) * props.sway + p.ox, y: p.y + p.oy, r: p.r, op: p.op }))
  if (props.links > 0) {
    ctx.lineWidth = 0.8
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
      if (d < props.links) {
        ctx.strokeStyle = `rgba(${rgb},${(1 - d / props.links) * 0.22})`
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke()
      }
    }
  }
  for (const p of pts) {
    ctx.fillStyle = `rgba(${rgb},${p.op})`
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill()
  }
}
function step(dt: number) {
  const k = Math.exp(-2.5 * dt)
  for (const p of ps) {
    p.y += (props.gravity * p.v / 10) * dt
    p.x += props.wind * dt
    if (ptr) {
      const dx = p.x + p.ox - ptr.x, dy = p.y + p.oy - ptr.y, d = Math.hypot(dx, dy)
      if (d > 0 && d < props.pointerRadius) {
        const f = (1 - d / props.pointerRadius) * 120 * dt
        p.ox += (dx / d) * f; p.oy += (dy / d) * f
      }
    }
    p.ox *= k; p.oy *= k                         // volta ao lugar naturalmente
    if (p.y < -10) { p.y = h + 10; p.x = rnd(0, w) }   // recycle
    else if (p.y > h + 10) { p.y = -10; p.x = rnd(0, w) }
    if (p.x > w + 20) p.x = -20
    else if (p.x < -20) p.x = w + 20
  }
}
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05) // evita saltos após aba em segundo plano
  last = now
  step(dt); draw(now)
  raf = requestAnimationFrame(frame)
}
function start() {
  if (raf || !visible || document.hidden || mq?.matches) return
  last = performance.now()
  raf = requestAnimationFrame(frame)
}
function stop() { if (raf) cancelAnimationFrame(raf); raf = 0 }
function resize() {
  if (!host || !canvas.value || !ctx) return
  const r = host.getBoundingClientRect()
  w = r.width; h = r.height
  const dpr = Math.min(window.devicePixelRatio || 1, props.maxDpr)
  canvas.value.width = Math.round(w * dpr); canvas.value.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  color(); seed()
  if (!raf) draw(0)
}
function onMove(e: PointerEvent) {
  const r = host!.getBoundingClientRect()
  ptr = { x: e.clientX - r.left, y: e.clientY - r.top }
}
const onLeave = () => { ptr = null }
const onVis = () => (document.hidden ? stop() : start())
const onMotion = () => { stop(); seed(); mq?.matches ? draw(0) : start() }

onMounted(() => {
  host = canvas.value?.parentElement ?? null
  ctx = canvas.value?.getContext('2d') ?? null
  if (!host || !ctx) return
  mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', onMotion)
  ro = new ResizeObserver(resize); ro.observe(host)
  io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop() })
  io.observe(host)
  host.addEventListener('pointermove', onMove, { passive: true })
  host.addEventListener('pointerleave', onLeave)
  document.addEventListener('visibilitychange', onVis)
  resize()
})
onBeforeUnmount(() => {
  stop()
  io?.disconnect(); ro?.disconnect()
  mq?.removeEventListener('change', onMotion)
  host?.removeEventListener('pointermove', onMove)
  host?.removeEventListener('pointerleave', onLeave)
  document.removeEventListener('visibilitychange', onVis)
  ps = []; ctx = null
})
</script>
<template>
  <canvas ref="canvas" class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
</template>
