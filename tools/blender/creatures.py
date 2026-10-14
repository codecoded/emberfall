"""Creature parts (animated in code): slime, bat (body + wings), spitter plant, fire wisp core.

    blender -b -P creatures.py -- <out.glb>
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

out = sys.argv[sys.argv.index('--') + 1]
reset()

# ---- slime (origin at base, faces -Y); 'gloss' is tinted per world in game
b = Builder('slime', seed=3)
def blob(v):
    z = v.z
    if z < -0.12:
        z = -0.12 - (z + 0.12) * 0.15
    k = 1 + max(0, -v.z) * 0.9
    return (v.x * k, v.y * k, z + 0.12)
b.add('ico', (1.0, 0.95, 0.85), sub=3, shape=blob, color='#8f9aa0', color2='#ffffff', mat='gloss', smooth=True, jit=0.02, noise_amt=0.03, noise_freq=3)
b.add('ico', (0.32, 0.3, 0.26), (0.05, 0.05, 0.3), sub=2, mat='glow_white', smooth=True)
for sx in (1, -1):
    b.add('ico', (0.2, 0.1, 0.24), (0.17 * sx, -0.4, 0.36), sub=2, color='#ffffff', jit=0, smooth=True)
    b.add('ico', (0.1, 0.06, 0.14), (0.17 * sx, -0.44, 0.35), sub=1, color='#14101c', jit=0)
b.add('box', (0.2, 0.04, 0.03), (0, -0.47, 0.2), color='#14101c', jit=0)
b.finish()

# ---- bat
b = Builder('bat_body', seed=4)
fur, fur_l = '#3b2a5c', '#7a5aa8'
b.add('ico', (0.42, 0.38, 0.46), (0, 0, 0), sub=2, color=fur, color2=fur_l, noise_amt=0.02)
b.add('ico', (0.34, 0.32, 0.3), (0, -0.08, 0.26), sub=2, color=fur, color2=fur_l)
for sx in (1, -1):
    b.add('cone', (0.14, 0.08, 0.26), (0.12 * sx, -0.04, 0.48), color=fur, color2='#c98ab0', segs=4, rot=deg(0, 18 * sx, 0))
    b.add('ico', (0.09, 0.05, 0.07), (0.08 * sx, -0.22, 0.3), sub=1, mat='glow_red')
    b.add('cone', (0.035, 0.035, 0.09), (0.045 * sx, -0.2, 0.16), color='#ffffff', segs=4, rot=deg(180, 0, 0))
    b.add('cone', (0.05, 0.05, 0.12), (0.08 * sx, 0, -0.26), color='#241a38', segs=4, rot=deg(180, 0, 0))
b.finish()
for name, sx in (('bat_wingL', 1), ('bat_wingR', -1)):
    b = Builder(name, seed=5)
    S0, T1, T2, T3, T4, IN = (0, 0, 0.06), (0.55 * sx, 0, 0.42), (1.0 * sx, 0, 0.16), (0.86 * sx, 0, -0.2), (0.5 * sx, 0, -0.3), (0.12 * sx, 0, -0.22)
    for i, tri in enumerate(((S0, T1, T2), (S0, T2, T3), (S0, T3, T4), (S0, T4, IN))):
        b.poly(list(tri), color=('#5b3f8a', '#4a3274')[i % 2], jit=0.06)
    for tip in (T1, T2, T3, T4):
        mid = [(tip[k] + S0[k]) / 2 for k in range(3)]
        L = math.dist(tip, S0)
        ang = math.atan2(tip[0] - S0[0], tip[2] - S0[2])
        b.add('box', (0.035, 0.035, L), mid, rot=(0, ang, 0), color='#2a1d44')
    b.finish(loc=(0.16 * sx, 0, 0.1))

# ---- spitter plant
b = Builder('plant_stem', seed=6)
for i in range(5):
    a = i * math.tau / 5 + 0.3
    b.add('ico', (0.5, 0.22, 0.08), (math.cos(a) * 0.28, math.sin(a) * 0.28, 0.07), sub=1, rot=(0, -0.35, a), color='#2f7a44', color2='#8fd35a', grad_axis=0)
pts = [(0, 0, 0.0), (0.05, 0, 0.25), (0.02, 0, 0.5), (-0.04, 0, 0.72), (0, 0, 0.9)]
for i in range(4):
    p, q = pts[i], pts[i + 1]
    b.add('cyl', (0.13 - i * 0.012, 0.13 - i * 0.012, 0.3), [(p[k] + q[k]) / 2 for k in range(3)], rot=(0, math.atan2(q[0] - p[0], q[2] - p[2]), 0), color='#2f7a44', color2='#4fae58', segs=6)
for z, a in ((0.4, 0.5), (0.62, 3.4)):
    b.add('cone', (0.05, 0.05, 0.14), (math.cos(a) * 0.1, math.sin(a) * 0.1, z), rot=(0, 1.3, a), color='#e8d8a0', segs=4)
b.finish()
b = Builder('plant_head', seed=7)
def bulb(v):
    return (v.x, v.y * (1.15 if v.y < 0 else 0.9), v.z)
b.add('ico', (0.66, 0.7, 0.62), (0, 0, 0.12), sub=2, shape=bulb, color='#b02a5a', color2='#ff7d9d', noise_amt=0.02)
b.add('cyl', (0.36, 0.36, 0.08), (0, -0.36, 0.12), rot=deg(90, 0, 0), color='#2a0a1c', segs=8, jit=0)
for i in range(8):
    a = i * math.tau / 8
    b.add('cone', (0.07, 0.07, 0.14), (math.cos(a) * 0.15, -0.42, 0.12 + math.sin(a) * 0.15), rot=deg(90, 0, 0), color='#fff6dc', segs=4)
for x, y, z, s in ((0.2, -0.05, 0.37, 0.12), (-0.18, 0.1, 0.38, 0.1), (0.02, 0.22, 0.36, 0.11), (-0.26, -0.12, 0.2, 0.08), (0.28, 0.12, 0.16, 0.09)):
    b.add('ico', (s, s, s * 0.5), (x, y, z), sub=1, color='#fff0c8')
for i in range(6):
    a = i * math.tau / 6
    b.add('ico', (0.34, 0.16, 0.06), (math.cos(a) * 0.2, 0.18, 0.12 + math.sin(a) * 0.2), sub=1, rot=(0, -a, 0), color='#3f9a4f', color2='#9fe06a', grad_axis=0)
b.finish(loc=(0, 0, 0.9))

export(out)
