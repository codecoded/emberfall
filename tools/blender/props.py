"""World props for EMBERFALL. Origin at the base, front faces -Y (toward the game camera).

    blender -b -P props.py -- <out.glb>
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

out = sys.argv[sys.argv.index('--') + 1]
reset()
R = random.Random(11)
TAU = math.tau


def U(a, b):
    return R.uniform(a, b)


# ------------------------------------------------------------------ trees
def tree(name, c_dark, c_light, seed, h=3.0, spread=1.3, blobs=6, trunk=('#4a3024', '#8a5a3c'), size=2.0):
    b = Builder(name, seed=seed)
    r = random.Random(seed)
    lean = r.uniform(-0.25, 0.25)
    segs = 4
    for i in range(segs):
        z0, z1 = h * i / segs, h * (i + 1) / segs
        w = 0.55 - 0.3 * i / segs
        x0, x1 = lean * (i / segs) ** 2 * 2, lean * ((i + 1) / segs) ** 2 * 2
        b.add('cyl', (w, w, (z1 - z0) * 1.12), ((x0 + x1) / 2, 0, (z0 + z1) / 2), rot=(0, math.atan2(x1 - x0, z1 - z0), 0),
              color=trunk[0], color2=trunk[1], segs=6, taper=0.85, noise_amt=0.04)
    for a in (0.6, 2.2, 3.9, 5.2):
        b.add('cone', (0.3, 0.3, 0.7), (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.12), rot=(0, 1.2, a), color=trunk[0], segs=5)
    top = (lean * 2, 0, h)
    for a, zz in ((0.4, 0.7), (2.6, 0.8)):
        bx, by = math.cos(a) * 0.7, math.sin(a) * 0.5
        b.add('cyl', (0.16, 0.16, 1.0), (top[0] * zz + bx / 2, by / 2, h * zz + 0.3), rot=(0, math.atan2(bx, 0.7), 0), color=trunk[0], color2=trunk[1], segs=5, taper=0.6)
    for i in range(blobs):
        a = i * TAU / max(1, blobs - 1) + r.uniform(-0.4, 0.4)
        rad = 0 if i == 0 else spread * r.uniform(0.6, 1.0)
        s = size * (1.25 if i == 0 else r.uniform(0.65, 0.95))
        cz = h + (0.75 if i == 0 else r.uniform(-0.2, 0.55))
        b.add('ico', (s, s * 0.95, s * 0.82), (top[0] + math.cos(a) * rad, math.sin(a) * rad * 0.8, cz), sub=2,
              color=c_dark, color2=c_light, noise_amt=0.16, noise_freq=1.6, jit=0.07)
    return b.finish()


tree('tree_green1', '#1f5f3a', '#9bdc5c', 21)
tree('tree_green2', '#1b5a4a', '#7fd67a', 22, h=3.8, spread=1.1, blobs=5, size=1.8)
tree('tree_autumn', '#a8381f', '#ffc04a', 23, h=3.2, spread=1.4)
tree('tree_blossom', '#b0457c', '#ffd0e0', 24, h=2.7, spread=1.2, blobs=5, trunk=('#3c2a30', '#7a5560'))
tree('tree_ember', '#3a1420', '#c2452a', 25, h=3.4, spread=1.2, blobs=4, trunk=('#1c1418', '#4a3238'), size=1.7)

b = Builder('pine', seed=30)
b.add('cyl', (0.4, 0.4, 1.4), (0, 0, 0.7), color='#3c2a22', color2='#6a4a34', segs=6, taper=0.7)
for i in range(5):
    t = i / 4
    w = 2.6 - 1.9 * t
    b.add('cone', (w, w, 1.5 - 0.3 * t), (0, 0, 1.5 + i * 0.85), color='#17503f', color2='#5fb072', segs=7, noise_amt=0.1, noise_freq=2.2, jit=0.08)
b.finish()

b = Builder('tree_dead', seed=31)
for i in range(4):
    b.add('cyl', (0.5 - i * 0.09, 0.5 - i * 0.09, 1.0), (0.12 * i * i * 0.3, 0, 0.45 + i * 0.85), rot=(0, 0.1 * i, 0), color='#1e161c', color2='#4a3a44', segs=6, taper=0.8, noise_amt=0.04)
for a, z, L, tilt in ((0.2, 2.6, 1.6, 0.9), (3.0, 2.2, 1.3, 1.0), (1.6, 3.2, 1.1, 0.5), (4.4, 3.0, 1.2, 0.7), (3.4, 3.5, 0.9, 0.35)):
    dx, dy, dz = math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt) * 0.5, math.cos(tilt)
    b.add('cyl', (0.14, 0.14, L), (0.3 + dx * L / 2, dy * L / 2, z + dz * L / 2), rot=(0, tilt, a), color='#1e161c', color2='#54424c', segs=5, taper=0.3)
    b.add('cyl', (0.07, 0.07, L * 0.6), (0.3 + dx * L + dx * 0.1, dy * L, z + dz * L + 0.22), rot=(0, tilt * 0.3, a + 1), color='#2a2028', segs=4, taper=0.3)
b.finish()

# ------------------------------------------------------- small vegetation
for name, cols, seed in (('bush_a', ('#1f6a3c', '#a3e060'), 40), ('bush_b', ('#226052', '#7fd69a'), 41), ('bush_berry', ('#2a5a34', '#8fce58'), 42)):
    b = Builder(name, seed=seed)
    r = random.Random(seed)
    for i in range(4):
        s = r.uniform(0.6, 0.95)
        b.add('ico', (s, s * 0.9, s * 0.75), (r.uniform(-0.45, 0.45), r.uniform(-0.2, 0.2), s * 0.32), sub=2, color=cols[0], color2=cols[1], noise_amt=0.1, noise_freq=2.5)
    if name == 'bush_berry':
        for i in range(9):
            a, e = r.uniform(0, TAU), r.uniform(0.3, 1.2)
            b.add('ico', 0.09, (math.cos(a) * math.cos(e) * 0.5, math.sin(a) * math.cos(e) * 0.42, 0.3 + math.sin(e) * 0.35), sub=1, color='#ff4a6a')
    b.finish()

b = Builder('grass', seed=45)
for i in range(7):
    x, y = U(-0.42, 0.42), U(-0.25, 0.25)
    h, w, bend = U(0.25, 0.55), U(0.05, 0.09), U(-0.18, 0.18)
    b.poly([(x - w, y, 0), (x + w, y, 0), (x + bend, y, h)], color=mixc(hexc('#2f8a44'), hexc('#b4ee62'), U(0, 1)), jit=0.05)
b.finish()

b = Builder('fern', seed=46)
for i in range(7):
    a = i * TAU / 7 + U(-0.2, 0.2)
    L = U(0.5, 0.8)
    b.add('ico', (L, 0.2, 0.04), (math.cos(a) * L * 0.42, math.sin(a) * L * 0.42, 0.2), sub=1, rot=(0, -0.5, a), color='#1f6a3c', color2='#8fdc66', grad_axis=2)
b.finish()

for name, petal, center in (('flower_white', '#ffffff', '#ffd23a'), ('flower_red', '#ff4a5a', '#ffe06a'), ('flower_blue', '#6aa8ff', '#fff2a8'), ('flower_gold', '#ffc83a', '#fff6c8')):
    b = Builder(name, seed=50)
    for x, h in ((-0.15, 0.42), (0.12, 0.55), (0.02, 0.32)):
        b.add('cyl', (0.03, 0.03, h), (x, 0, h / 2), color='#3a9a4c', segs=4)
        for i in range(5):
            a = i * TAU / 5
            b.add('ico', (0.11, 0.05, 0.11), (x + math.cos(a) * 0.08, -0.01, h + math.sin(a) * 0.08), sub=1, color=petal, jit=0.03)
        b.add('ico', 0.075, (x, -0.035, h), sub=1, color=center)
    b.finish()


def mushroom(name, cap, cap2, glow=None, scale=1.0, dots=True):
    b = Builder(name, seed=55)
    b.add('cyl', (0.16 * scale, 0.16 * scale, 0.4 * scale), (0, 0, 0.2 * scale), color='#e8dcc0', color2='#fff8e4', segs=6, taper=0.7)
    def capf(v):
        return (v.x, v.y, max(v.z, -0.02) * 0.8)
    b.add('ico', (0.6 * scale, 0.6 * scale, 0.5 * scale), (0, 0, 0.4 * scale), sub=2, shape=capf, color=cap, color2=cap2, mat=glow or 'matte')
    if dots:
        for a, e in ((0.3, 0.8), (2.2, 0.6), (4.0, 0.9), (5.3, 0.5), (1.2, 1.3)):
            b.add('ico', 0.08 * scale, (math.cos(a) * math.cos(e) * 0.27 * scale, math.sin(a) * math.cos(e) * 0.27 * scale, (0.4 + math.sin(e) * 0.19) * scale), sub=1, color='#fff6dc')
    b.add('cyl', (0.1 * scale, 0.1 * scale, 0.22 * scale), (0.3 * scale, 0.05, 0.11 * scale), color='#e8dcc0', segs=5)
    b.add('ico', (0.3 * scale, 0.3 * scale, 0.2 * scale), (0.3 * scale, 0.05, 0.24 * scale), sub=1, shape=capf, color=cap, color2=cap2, mat=glow or 'matte')
    b.finish()


mushroom('mushroom_red', '#c22a2a', '#ff6a4a')
mushroom('mushroom_glow', '#59e8ff', '#59e8ff', glow='crystal_cyan', dots=False)
mushroom('mushroom_violet', '#a45cff', '#a45cff', glow='crystal_violet', dots=False)

b = Builder('shroom_giant', seed=56)
for i in range(4):
    b.add('cyl', (0.5 - i * 0.07, 0.5 - i * 0.07, 0.95), (0.08 * i * i, 0, 0.45 + i * 0.85), rot=(0, 0.12 * i, 0), color='#3a4a7a', color2='#9fb4e6', segs=7, taper=0.9)
def gcap(v):
    return (v.x, v.y, max(v.z, -0.05) * 0.75)
b.add('ico', (3.2, 3.2, 2.0), (0.75, 0, 3.4), sub=2, shape=gcap, color='#2a3f8a', color2='#7fe0ff', noise_amt=0.08)
b.add('cyl', (2.6, 2.6, 0.08), (0.75, 0, 3.3), mat='crystal_cyan', segs=10)
for a, e in ((0.3, 0.7), (2.0, 0.5), (3.6, 0.8), (5.0, 0.45), (1.2, 1.2), (4.3, 1.1)):
    b.add('ico', 0.3, (0.75 + math.cos(a) * math.cos(e) * 1.45, math.sin(a) * math.cos(e) * 1.45, 3.4 + math.sin(e) * 0.72), sub=1, mat='crystal_cyan')
b.finish()

b = Builder('vine', seed=57)
x = 0
for i in range(7):
    z = -0.12 - i * 0.26
    x += U(-0.06, 0.06)
    b.add('cyl', (0.035, 0.035, 0.28), (x, 0, z), color='#2a6a3a', segs=4)
    b.add('ico', (0.2, 0.05, 0.12), (x + (0.1 if i % 2 else -0.1), 0, z), sub=1, rot=(0, 0.5 if i % 2 else -0.5, 0), color='#2f8a44', color2='#a8e860', grad_axis=0)
b.finish()

b = Builder('lilypad', seed=58)
b.add('cyl', (0.7, 0.7, 0.03), (0, 0, 0.015), color='#2f8a54', color2='#7fd67a', segs=9, grad_axis=0)
b.add('ico', (0.2, 0.2, 0.14), (0.1, 0.05, 0.08), sub=1, color='#ffc4dc')
b.finish()

b = Builder('stump', seed=59)
b.add('cyl', (0.8, 0.8, 0.5), (0, 0, 0.25), color='#4a3024', color2='#7a5236', segs=7, taper=0.8, noise_amt=0.05)
b.add('cyl', (0.56, 0.56, 0.04), (0, 0, 0.51), color='#d8b888', segs=7)
b.finish()

# ------------------------------------------------------------------- rocks
for name, c1, c2, seed, sz in (('rock_a', '#4a4660', '#a8a4c0', 60, (1.0, 0.8, 0.7)), ('rock_b', '#3f4258', '#9aa0bc', 61, (1.4, 1.0, 0.6)),
                               ('rock_c', '#4a4050', '#b0a0a8', 62, (0.7, 0.6, 0.9)), ('rock_moss', '#4a4660', '#7fc85a', 63, (1.2, 0.9, 0.75)),
                               ('rock_dark', '#1c1620', '#5a4650', 64, (1.2, 0.9, 0.9)), ('rock_ice', '#3a4a88', '#b8e4ff', 65, (1.1, 0.9, 0.8))):
    b = Builder(name, seed=seed)
    def flat(v):
        return (v.x, v.y, max(v.z, -0.12) + 0.12)
    b.add('ico', sz, sub=2, shape=flat, color=c1, color2=c2, noise_amt=0.2, noise_freq=2.2, jit=0.08)
    b.finish()


def crystal(name, mat, seed, n=5, scale=1.0):
    b = Builder(name, seed=seed)
    r = random.Random(seed)
    b.add('ico', (0.9 * scale, 0.7 * scale, 0.3 * scale), (0, 0, 0.05), sub=1, color='#2a2a44', color2='#5a5a7c', noise_amt=0.1)
    for i in range(n):
        a = i * TAU / n + r.uniform(-0.3, 0.3)
        tilt = 0 if i == 0 else r.uniform(0.25, 0.7)
        L = scale * (1.5 if i == 0 else r.uniform(0.6, 1.1))
        w = scale * (0.3 if i == 0 else r.uniform(0.16, 0.24))
        dx, dy, dz = math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)
        base = (dx * 0.12, dy * 0.12, 0.05)
        b.add('cyl', (w, w, L * 0.75), (base[0] + dx * L * 0.375, base[1] + dy * L * 0.375, base[2] + dz * L * 0.375), rot=(0, tilt, a), mat=mat, segs=5)
        b.add('cone', (w, w, L * 0.25), (base[0] + dx * L * 0.875, base[1] + dy * L * 0.875, base[2] + dz * L * 0.875), rot=(0, tilt, a), mat=mat, segs=5)
    b.finish()


crystal('crystal_cyan', 'crystal_cyan', 70)
crystal('crystal_violet', 'crystal_violet', 71, n=6)
crystal('crystal_pink', 'crystal_pink', 72, n=4, scale=0.7)

for name, c1, c2, flip in (('stalactite', '#2a3058', '#6a78b0', True), ('stalagmite', '#2a3058', '#7a88c0', False), ('stalactite_dark', '#1c1620', '#5a4650', True)):
    b = Builder(name, seed=75)
    for x, w, h in ((0, 0.6, 1.6), (0.38, 0.38, 0.9), (-0.34, 0.32, 0.7)):
        b.add('cone', (w, w, h), (x, 0, -h / 2 if flip else h / 2), rot=deg(180 if flip else 0, 0, 0), color=c1, color2=c2, segs=6, noise_amt=0.05, noise_freq=3)
    b.finish()

# --------------------------------------------------------------- pickups
b = Builder('coin', seed=80)
b.add('cyl', (0.46, 0.46, 0.08), rot=deg(90, 0, 0), color='#ffb41f', color2='#fff2a0', mat='metal', segs=10)
b.add('cyl', (0.3, 0.3, 0.11), rot=deg(90, 0, 0), color='#ffd84a', mat='metal', segs=4)
b.finish()

b = Builder('gem', seed=81)
b.add('cone', (0.42, 0.42, 0.34), (0, 0, 0.17), mat='crystal_pink', segs=6)
b.add('cone', (0.42, 0.42, 0.34), (0, 0, -0.17), rot=deg(180, 0, 0), mat='crystal_pink', segs=6)
b.finish()

b = Builder('heart', seed=82)
for sx in (1, -1):
    b.add('ico', (0.3, 0.24, 0.3), (0.12 * sx, 0, 0.08), sub=2, mat='heart', smooth=True)
b.add('cone', (0.5, 0.24, 0.42), (0, 0, -0.14), rot=deg(180, 0, 0), mat='heart', segs=8)
b.finish()

b = Builder('rune', seed=83)
b.add('box', (0.6, 0.16, 0.8), color='#4a4a66', color2='#9a9ac0', bevel=0.07, taper=0.8, noise_amt=0.02)
for x, z, w, h, r_ in ((0, 0.12, 0.06, 0.42, 0), (0.09, 0.2, 0.05, 0.24, -40), (-0.09, 0.02, 0.05, 0.24, -40), (0, -0.2, 0.22, 0.05, 0)):
    b.add('box', (w, 0.04, h), (x, -0.085, z), rot=deg(0, r_, 0), mat='glow_gold')
b.finish()

b = Builder('potion', seed=84)
b.add('ico', (0.34, 0.34, 0.34), (0, 0, 0.17), sub=2, mat='heart', smooth=True)
b.add('cyl', (0.12, 0.12, 0.16), (0, 0, 0.4), color='#d8e8ff', mat='gloss', segs=6)
b.add('cyl', (0.14, 0.14, 0.06), (0, 0, 0.5), color='#8a5a3c', segs=6)
b.finish()

# ------------------------------------------------------------ interactive
b = Builder('chest_base', seed=90)
b.add('box', (0.95, 0.62, 0.46), (0, 0, 0.23), color='#5a3520', color2='#8f5a34', bevel=0.03)
for x in (-0.33, 0.33):
    b.add('box', (0.1, 0.66, 0.48), (x, 0, 0.235), color='#e0a83a', mat='metal', bevel=0.012)
b.add('box', (1.0, 0.66, 0.06), (0, 0, 0.03), color='#e0a83a', mat='metal')
b.finish()
b = Builder('chest_lid', seed=91)
def arch(v):
    return (v.x, v.y, v.z + (0.1 * (1 - (v.y / 0.31) ** 2) if v.z > 0 else 0))
b.add('box', (0.95, 0.62, 0.22), (0, -0.31, 0.11), color='#6a4026', color2='#a06a3c', bevel=0.03, shape=arch)
for x in (-0.33, 0.33):
    b.add('box', (0.1, 0.66, 0.24), (x, -0.31, 0.115), color='#e0a83a', mat='metal', bevel=0.012, shape=arch)
b.add('box', (0.14, 0.05, 0.18), (0, -0.64, 0.04), color='#ffd85a', mat='metal', bevel=0.02)
b.finish(loc=(0, 0.31, 0.46))
b = Builder('chest_glow', seed=92)
b.add('box', (0.8, 0.5, 0.06), (0, 0, 0.44), mat='glow_gold')
b.finish()

b = Builder('shrine', seed=93)
b.add('cyl', (1.3, 1.3, 0.2), (0, 0, 0.1), color='#4a4660', color2='#8a86a8', segs=8, noise_amt=0.02)
b.add('cyl', (0.95, 0.95, 0.2), (0, 0, 0.3), color='#565270', color2='#9a96b8', segs=8)
b.add('cyl', (0.5, 0.5, 0.9), (0, 0, 0.85), color='#565270', color2='#b0acd0', segs=6, taper=0.75)
b.add('cyl', (0.8, 0.8, 0.14), (0, 0, 1.35), color='#6a6688', color2='#b8b4d8', segs=8)
for a in range(4):
    an = a * TAU / 4 + TAU / 8
    b.add('cone', (0.14, 0.14, 0.5), (math.cos(an) * 0.32, math.sin(an) * 0.32, 1.62), rot=(0, 0.3, an), color='#e0a83a', mat='metal', segs=4)
b.add('cone', (0.36, 0.36, 0.45), (0, 0, 1.92), mat='shrine_gem', segs=6)
b.add('cone', (0.36, 0.36, 0.3), (0, 0, 1.545), rot=deg(180, 0, 0), mat='shrine_gem', segs=6)
b.finish()

b = Builder('portal', seed=94)
N = 13
for i in range(N):
    a = math.pi * i / (N - 1)
    x, z = math.cos(a) * 1.35, 2.0 + math.sin(a) * 1.35
    b.add('box', (0.5, 0.6, 0.46), (x, 0, z), rot=(0, math.pi / 2 - a, 0), color='#3f3d5c', color2='#9a98c0', bevel=0.05, noise_amt=0.03, grad_axis=1)
    if i % 2 == 0:
        b.add('box', (0.12, 0.05, 0.2), (math.cos(a) * 1.35, -0.31, 2.0 + math.sin(a) * 1.35), rot=(0, math.pi / 2 - a, 0), mat='portal_rune')
for sx in (1, -1):
    for j in range(4):
        b.add('box', (0.52, 0.62, 0.5), (1.35 * sx, 0, 0.25 + j * 0.5), color='#3a3856', color2='#8f8db8', bevel=0.05, noise_amt=0.03, grad_axis=1)
        if j in (1, 3):
            b.add('box', (0.12, 0.05, 0.22), (1.35 * sx, -0.32, 0.25 + j * 0.5), mat='portal_rune')
    b.add('box', (0.8, 0.8, 0.22), (1.35 * sx, 0, 0.11), color='#4a4868', color2='#a09ec8', bevel=0.04)
b.add('cone', (0.5, 0.5, 0.6), (0, 0, 3.85), mat='portal_rune', segs=4)
b.add('box', (3.6, 1.0, 0.16), (0, 0, 0.0), color='#3a3856', color2='#7a78a0', bevel=0.04)
b.finish()

b = Builder('stall', seed=95)
wood, wood_l = '#5a3520', '#9a6a40'
for x in (-1.4, 1.4):
    for y in (-0.6, 0.6):
        b.add('cyl', (0.1, 0.1, 2.3 if y > 0 else 2.0), (x, y, 1.15 if y > 0 else 1.0), color=wood, color2=wood_l, segs=5)
for i in range(8):
    x = -1.4 + 0.4 * i
    b.add('box', (0.4, 1.6, 0.06), (x, 0, 2.2), rot=deg(-13, 0, 0), color=('#c8323c', '#f4e6c4')[i % 2])
    b.add('cone', (0.4, 0.05, 0.22), (x, -0.8, 1.92), rot=deg(180, 0, 0), color=('#c8323c', '#f4e6c4')[i % 2], segs=4)
b.add('box', (2.6, 0.7, 0.8), (0, -0.2, 0.4), color=wood, color2=wood_l, bevel=0.03)
b.add('box', (2.8, 0.85, 0.08), (0, -0.2, 0.84), color='#8a5a34', bevel=0.02)
b.add('box', (2.2, 0.04, 0.5), (0, -0.56, 0.42), color='#2a376f')
b.add('box', (0.3, 0.05, 0.3), (0, -0.59, 0.42), rot=deg(0, 45, 0), color='#f0bc45', mat='metal')
for x, m in ((-0.9, 'heart'), (-0.6, 'crystal_cyan'), (-0.3, 'crystal_violet')):
    b.add('ico', 0.22, (x, -0.3, 0.99), sub=1, mat=m)
    b.add('cyl', (0.08, 0.08, 0.1), (x, -0.3, 1.14), color='#d8e8ff', segs=5)
b.add('box', (0.5, 0.3, 0.2), (0.6, -0.25, 0.98), color='#6a4026', bevel=0.02)
b.add('box', (0.07, 0.03, 0.75), (0.25, -0.3, 1.2), rot=deg(0, 25, 0), color='#c3d2f2', mat='metal')
b.add('cyl', (0.4, 0.4, 0.5), (1.9, 0.2, 0.25), color=wood, color2=wood_l, segs=8)
b.add('box', (0.5, 0.5, 0.5), (-1.95, 0.1, 0.25), color='#6a4026', color2='#9a6a40', bevel=0.03)
b.add('box', (0.04, 0.04, 0.4), (1.1, -0.75, 1.75), color='#2a2a33')
b.add('box', (0.2, 0.2, 0.26), (1.1, -0.75, 1.45), mat='glow_orange', bevel=0.03)
b.add('box', (0.24, 0.24, 0.04), (1.1, -0.75, 1.6), color='#2a2a33', mat='metal')
b.finish()

b = Builder('sign', seed=96)
b.add('cyl', (0.12, 0.12, 1.3), (0, 0, 0.65), color='#4a3024', color2='#7a5236', segs=5)
b.add('box', (1.0, 0.08, 0.5), (0, -0.06, 1.15), color='#8a5a34', color2='#b88a54', bevel=0.03, rot=deg(0, -4, 0))
b.add('box', (0.5, 0.03, 0.08), (-0.05, -0.11, 1.15), color='#3c2418')
b.add('cone', (0.24, 0.03, 0.24), (0.3, -0.11, 1.15), rot=deg(0, 90, 0), color='#3c2418', segs=3)
b.finish()

b = Builder('spikes', seed=97)
b.add('box', (1.0, 0.9, 0.08), (0, 0, 0.04), color='#2a2630')
for i in range(4):
    for y in (-0.25, 0.25):
        b.add('cone', (0.2, 0.2, 0.58), (-0.375 + i * 0.25, y + (0.08 if i % 2 else -0.08), 0.33), color='#4a4658', color2='#e8e8ff', mat='metal', segs=4)
b.finish()

b = Builder('plank', seed=98)
for i in range(4):
    b.add('box', (1.0, 0.27, 0.12), (0, -0.45 + i * 0.3, -0.06 + U(-0.012, 0.012)), color='#6a4026', color2='#b88a54', bevel=0.02, grad_axis=1, jit=0.1)
b.add('box', (0.14, 1.3, 0.12), (0, 0, -0.18), color='#4a3024')
b.finish()

b = Builder('movplat', seed=99)
b.add('box', (1.0, 1.4, 0.3), (0, 0, -0.15), color='#4a4868', color2='#a09ec8', bevel=0.05)
b.add('box', (0.6, 0.04, 0.06), (0, -0.71, -0.15), mat='glow_cyan')
b.add('cone', (0.8, 1.0, 0.7), (0, 0, -0.62), rot=deg(180, 0, 0), color='#2f2d48', color2='#5a5880', segs=6, noise_amt=0.06)
b.finish()

b = Builder('torch', seed=100)
b.add('cyl', (0.09, 0.09, 1.5), (0, 0, 0.75), color='#3c2a22', color2='#6a4a34', segs=5)
b.add('cyl', (0.3, 0.3, 0.2), (0, 0, 1.55), color='#2a2a33', color2='#6a6a7c', mat='metal', segs=6, taper=1.5)
b.add('cyl', (0.34, 0.34, 0.05), (0, 0, 1.63), mat='glow_orange', segs=6)
b.finish()

b = Builder('lantern_post', seed=101)
b.add('cyl', (0.14, 0.14, 2.6), (0, 0, 1.3), color='#3c2a22', color2='#6a4a34', segs=5)
b.add('box', (0.7, 0.09, 0.09), (0.28, 0, 2.5), color='#3c2a22')
b.add('box', (0.03, 0.03, 0.3), (0.55, 0, 2.32), color='#2a2a33')
b.add('box', (0.24, 0.24, 0.32), (0.55, 0, 2.02), mat='glow_orange', bevel=0.03)
b.add('cone', (0.36, 0.36, 0.16), (0.55, 0, 2.26), color='#2a2a33', mat='metal', segs=4)
b.add('box', (0.28, 0.28, 0.04), (0.55, 0, 1.85), color='#2a2a33', mat='metal')
b.finish()

b = Builder('fence', seed=102)
for x in (-0.9, 0, 0.9):
    b.add('box', (0.14, 0.14, 0.9 + U(-0.08, 0.08)), (x, 0, 0.45), rot=deg(0, U(-4, 4), 0), color='#5a3a28', color2='#9a6a44', bevel=0.02)
for z in (0.35, 0.68):
    b.add('box', (2.0, 0.07, 0.11), (0, -0.04, z), rot=deg(0, U(-2, 2), 0), color='#6a4630', color2='#a87a50', grad_axis=0)
b.finish()

for name, sz in (('crate', 0.7), ('barrel', 0)):
    b = Builder(name, seed=103)
    if sz:
        b.add('box', (sz, sz, sz), (0, 0, sz / 2), color='#6a4026', color2='#a87a48', bevel=0.03)
        for x in (-1, 1):
            b.add('box', (0.08, sz + 0.03, sz + 0.03), (x * (sz / 2 - 0.05), 0, sz / 2), color='#4a2c1a', bevel=0.01)
    else:
        b.add('cyl', (0.62, 0.62, 0.85), (0, 0, 0.425), color='#6a4026', color2='#a87a48', segs=9, shape=lambda v: (v.x * (1.12 - v.z * v.z * 0.6), v.y * (1.12 - v.z * v.z * 0.6), v.z))
        for z in (0.18, 0.67):
            b.add('cyl', (0.67, 0.67, 0.07), (0, 0, z), color='#3a3a48', mat='metal', segs=9)
    b.finish()

# ------------------------------------------------------------ architecture
b = Builder('pillar', seed=110)
st1, st2 = '#3a3450', '#9c94b8'
b.add('box', (1.1, 1.1, 0.3), (0, 0, 0.15), color=st1, color2=st2, bevel=0.04)
b.add('box', (0.9, 0.9, 0.2), (0, 0, 0.4), color=st1, color2=st2, bevel=0.04)
b.add('cyl', (0.7, 0.7, 3.4), (0, 0, 2.2), color=st1, color2=st2, segs=8, noise_amt=0.02)
b.add('box', (0.95, 0.95, 0.22), (0, 0, 4.0), color=st2, bevel=0.04)
b.add('box', (1.2, 1.2, 0.3), (0, 0, 4.25), color=st1, color2=st2, bevel=0.05)
b.finish()

b = Builder('pillar_broken', seed=111)
b.add('box', (1.1, 1.1, 0.3), (0, 0, 0.15), color=st1, color2=st2, bevel=0.04)
b.add('box', (0.9, 0.9, 0.2), (0, 0, 0.4), color=st1, color2=st2, bevel=0.04)
b.add('cyl', (0.7, 0.7, 1.5), (0, 0, 1.25), color=st1, color2=st2, segs=8, noise_amt=0.05, shape=lambda v: (v.x, v.y, v.z + (v.x * 0.35 if v.z > 0 else 0)))
b.add('cyl', (0.7, 0.7, 0.8), (1.2, 0.2, 0.36), rot=deg(0, 84, 20), color=st1, color2=st2, segs=8, noise_amt=0.05)
b.finish()

b = Builder('arch', seed=112)
for sx in (1, -1):
    b.add('box', (0.8, 0.9, 4.0), (2.2 * sx, 0, 2.0), color=st1, color2=st2, bevel=0.05, noise_amt=0.02)
    b.add('box', (1.0, 1.1, 0.3), (2.2 * sx, 0, 0.15), color=st1, color2=st2, bevel=0.04)
for i in range(9):
    a = math.pi * i / 8
    b.add('box', (0.75, 0.9, 0.72), (math.cos(a) * 2.2, 0, 4.0 + math.sin(a) * 1.6), rot=(0, math.pi / 2 - a, 0), color=st1, color2=st2, bevel=0.05, grad_axis=1, noise_amt=0.03)
b.finish()

b = Builder('tower', seed=113)
b.add('cyl', (2.4, 2.4, 7.0), (0, 0, 3.5), color='#2a2438', color2='#6a5e80', segs=8, taper=0.86, noise_amt=0.04)
b.add('cyl', (2.6, 2.6, 0.5), (0, 0, 7.2), color='#3a3450', color2='#7a6e90', segs=8)
for i in range(8):
    a = i * TAU / 8
    b.add('box', (0.5, 0.4, 0.5), (math.cos(a) * 1.18, math.sin(a) * 1.18, 7.65), rot=(0, 0, a + math.pi / 2), color='#3a3450')
b.add('cone', (2.3, 2.3, 2.6), (0, 0, 8.9), color='#5a1f2a', color2='#a8452f', segs=8)
for z, x in ((3.0, 0.0), (5.2, 0.35), (4.2, -0.6)):
    b.add('box', (0.26, 0.2, 0.5), (x, -1.12, z), mat='glow_orange')
b.finish()

b = Builder('castle_wall', seed=114)
b.add('box', (6.0, 1.0, 3.2), (0, 0, 1.6), color='#2a2438', color2='#6a5e80', bevel=0.03, noise_amt=0.03)
for i in range(6):
    b.add('box', (0.55, 1.1, 0.6), (-2.5 + i, 0, 3.5), color='#3a3450', color2='#7a6e90', bevel=0.03)
for x in (-1.5, 1.5):
    b.add('box', (0.3, 0.1, 0.7), (x, -0.5, 1.9), mat='glow_orange')
b.finish()

b = Builder('banner', seed=115)
b.add('cyl', (0.08, 0.08, 3.4), (0, 0, 1.7), color='#2a2a33', color2='#6a6a7c', mat='metal', segs=5)
b.add('box', (1.0, 0.07, 0.07), (0.42, 0, 3.25), color='#2a2a33', mat='metal')
b.add('box', (0.8, 0.03, 1.5), (0.48, 0, 2.48), color='#5a1420', color2='#c22a40')
b.add('cone', (0.8, 0.03, 0.4), (0.48, 0, 1.55), rot=deg(180, 0, 0), color='#5a1420', segs=4)
b.add('box', (0.3, 0.05, 0.3), (0.48, -0.01, 2.6), rot=deg(0, 45, 0), color='#f0bc45', mat='metal')
b.finish()

b = Builder('skulls', seed=116)
for x, y, z, s in ((0, 0, 0.16, 0.34), (0.32, 0.1, 0.13, 0.28), (-0.3, -0.05, 0.14, 0.3), (0.08, -0.02, 0.4, 0.3)):
    b.add('ico', (s, s * 1.05, s * 0.92), (x, y, z), sub=1, color='#b8b094', color2='#f4eed4')
    for sx in (1, -1):
        b.add('box', (s * 0.24, 0.05, s * 0.24), (x + sx * s * 0.2, y - s * 0.48, z + 0.02), color='#14101c')
b.add('cyl', (0.07, 0.07, 0.8), (0.1, -0.3, 0.05), rot=deg(0, 90, 20), color='#ece5c9', segs=5)
b.finish()

# ------------------------------------------------------------ backdrop
def mountain(name, c1, c2, seed, sharp=1.5):
    b = Builder(name, seed=seed)
    def peak(v):
        r = math.hypot(v.x, v.y)
        return (v.x, v.y, max(0.0, 1 - r * 2) ** sharp)
    b.add('ico', (1, 1, 1), sub=3, shape=peak, color=c1, color2=c2, noise_amt=0.07, noise_freq=4.5, jit=0.06)
    b.finish()


mountain('mountain_a', '#5a4a7a', '#fff0f4', 120)
mountain('mountain_b', '#4a4270', '#e8d4f0', 121, sharp=1.1)
mountain('mountain_dark', '#1c1422', '#7a3a3a', 122, sharp=1.8)
mountain('volcano', '#1c1422', '#5a2a2a', 123, sharp=0.75)

for name, seed in (('cloud_a', 130), ('cloud_b', 131)):
    b = Builder(name, seed=seed)
    r = random.Random(seed)
    for i in range(6):
        s = r.uniform(0.9, 1.7)
        b.add('ico', (s * 1.5, s, s * 0.7), (i * 0.85 - 2.1 + r.uniform(-0.2, 0.2), r.uniform(-0.3, 0.3), r.uniform(0, 0.3) + (0.35 if 1 <= i <= 3 else 0)),
              sub=2, color='#c9a0c0', color2='#ffffff', smooth=True, jit=0.0, noise_amt=0.08)
    b.finish()

# ----------------------------------------------------------------- swords
def sword(name, L, blade, blade2, guard, core=None, w=0.085):
    b = Builder(name, seed=140)
    b.add('cyl', (0.05, 0.05, 0.22), (0, 0, 0), color='#3a2418', segs=5)
    b.add('ico', 0.1, (0, 0, -0.14), sub=1, color=guard, mat='metal')
    b.add('box', (0.05, 0.3, 0.06), (0, 0, 0.13), color=guard, mat='metal', bevel=0.015)
    b.add('box', (0.028, w, L), (0, 0, 0.16 + L / 2), color=blade, color2=blade2, mat='metal', bevel=0.01)
    b.add('cone', (0.028, w, w * 1.6), (0, 0, 0.16 + L + w * 0.8), color=blade2, mat='metal', segs=4)
    if core:
        b.add('box', (0.036, w * 0.34, L * 0.86), (0, 0, 0.2 + L * 0.43), mat=core)
    b.finish()


sword('sword_1', 0.82, '#9aa8c8', '#f0f4ff', '#f0bc45')
sword('sword_2', 0.95, '#5a7ad8', '#d8ecff', '#c3d2f2', core='glow_cyan', w=0.1)
sword('sword_3', 1.05, '#d8962a', '#fff0b0', '#b8263a', core='glow_orange', w=0.115)

export(out)
