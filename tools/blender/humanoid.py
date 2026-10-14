"""Builds rigged + animated humanoid characters: hero, skeleton, sorcerer, merchant.

    blender -b -P humanoid.py -- <style> <out.glb>

Blender space: Z up, character faces -Y, its left is +X.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

style, out = sys.argv[sys.argv.index('--') + 1:][:2]
reset()

BONES = [
    ('root', (0, 0, 0), (0, 0, 0.2), None),
    ('hips', (0, 0, 0.62), (0, 0, 0.78), 'root'),
    ('spine', (0, 0, 0.78), (0, 0, 1.0), 'hips'),
    ('chest', (0, 0, 1.0), (0, 0, 1.22), 'spine'),
    ('head', (0, 0, 1.25), (0, 0, 1.62), 'chest'),
    ('cape1', (0, 0.15, 1.2), (0, 0.2, 0.95), 'chest'),
    ('cape2', (0, 0.2, 0.95), (0, 0.24, 0.7), 'cape1'),
    ('cape3', (0, 0.24, 0.7), (0, 0.26, 0.45), 'cape2'),
]
for s, sx in (('L', 1), ('R', -1)):
    BONES += [
        ('upperarm_' + s, (0.27 * sx, 0, 1.17), (0.29 * sx, 0, 0.92), 'chest'),
        ('forearm_' + s, (0.29 * sx, 0, 0.92), (0.30 * sx, 0, 0.68), 'upperarm_' + s),
        ('hand_' + s, (0.30 * sx, 0, 0.68), (0.30 * sx, 0, 0.58), 'forearm_' + s),
        ('grip_' + s, (0.30 * sx, 0, 0.63), (0.30 * sx, -0.25, 0.63), 'hand_' + s),
        ('thigh_' + s, (0.11 * sx, 0, 0.62), (0.11 * sx, 0, 0.34), 'hips'),
        ('shin_' + s, (0.11 * sx, 0, 0.34), (0.11 * sx, 0, 0.07), 'thigh_' + s),
        ('foot_' + s, (0.11 * sx, 0, 0.07), (0.11 * sx, -0.16, 0.0), 'shin_' + s),
    ]
NAMES = [b[0] for b in BONES]
b = Builder(style, NAMES, seed=7)
A = b.add
SIDES = (('L', 1), ('R', -1))


def cape(c_top, c_bot, width=0.44):
    zs = [(1.2, 0.95), (0.95, 0.7), (0.7, 0.45)]
    ys = [(0.15, 0.2), (0.2, 0.24), (0.24, 0.26)]
    for i in range(3):
        z1, z0 = zs[i]
        y1, y0 = ys[i]
        w1, w0 = width + i * 0.06, width + (i + 1) * 0.06
        col = mixc(hexc(c_top), hexc(c_bot), i / 2)
        for xa, xb in ((-1, 0), (0, 1)):
            b.poly([(xa * w1 / 2, y1, z1), (xb * w1 / 2, y1 + (0.02 if xa == 0 or xb == 0 else 0), z1),
                    (xb * w0 / 2, y0 + (0.02 if xa == 0 or xb == 0 else 0), z0 - 0.01), (xa * w0 / 2, y0, z0 - 0.01)],
                   color=col, bone='cape%d' % (i + 1), jit=0.08)


if style == 'hero':
    steel, steel_l, steel_d = '#8fa6d6', '#c3d2f2', '#4d5f96'
    gold, cloth, leather, skin = '#f0bc45', '#2a376f', '#5d3b27', '#e8b08a'
    A('box', (0.30, 0.20, 0.20), (0, 0, 0.67), color=cloth, bone='hips', bevel=0.03)
    A('box', (0.34, 0.24, 0.06), (0, 0, 0.79), color=leather, bone='hips', bevel=0.015)
    A('box', (0.09, 0.03, 0.08), (0, -0.125, 0.79), color=gold, bone='hips', mat='metal', bevel=0.01)
    for x, y, w in ((0, -0.115, 0.16), (0.15, 0, 0.14), (-0.15, 0, 0.14), (0, 0.115, 0.16)):
        sz = (w, 0.035, 0.2) if x == 0 else (0.035, w, 0.18)
        A('box', sz, (x, y, 0.66), color=steel, color2=steel_l, bone='hips', mat='metal', bevel=0.012, taper=0.8)
    A('box', (0.30, 0.21, 0.22), (0, 0, 0.90), color=steel_d, bone='spine', mat='metal', bevel=0.03, taper=1.1)
    A('box', (0.33, 0.23, 0.26), (0, 0, 1.11), color=steel, color2=steel_l, bone='chest', mat='metal', bevel=0.045, taper=1.28)
    A('box', (0.10, 0.03, 0.12), (0, -0.15, 1.13), color=gold, bone='chest', mat='metal', bevel=0.02, rot=deg(0, 45, 0))
    A('cyl', (0.21, 0.21, 0.07), (0, 0, 1.25), color=gold, bone='chest', mat='metal', segs=8)
    for s, sx in SIDES:
        A('ico', (0.22, 0.25, 0.17), (0.275 * sx, 0, 1.2), color=gold, color2='#fff0a8', bone='upperarm_' + s, mat='metal', sub=1)
        A('cyl', (0.115, 0.115, 0.24), (0.28 * sx, 0, 1.04), color='#3b456e', bone='upperarm_' + s, segs=6)
        A('cyl', (0.135, 0.135, 0.22), (0.295 * sx, 0, 0.8), color=steel, color2=steel_l, bone='forearm_' + s, mat='metal', segs=6, taper=1.25)
        A('ico', 0.115, (0.30 * sx, 0, 0.63), color=leather, bone='hand_' + s, sub=1)
        A('cyl', (0.155, 0.16, 0.30), (0.11 * sx, 0, 0.48), color=cloth, bone='thigh_' + s, segs=6)
        A('ico', (0.12, 0.13, 0.12), (0.11 * sx, -0.045, 0.34), color=gold, bone='shin_' + s, mat='metal', sub=1)
        A('cyl', (0.14, 0.15, 0.27), (0.11 * sx, 0, 0.2), color=steel, color2=steel_l, bone='shin_' + s, mat='metal', segs=6, taper=1.3)
        A('box', (0.135, 0.27, 0.095), (0.11 * sx, -0.05, 0.048), color=leather, bone='foot_' + s, bevel=0.025)
    # helmet
    A('ico', (0.41, 0.43, 0.42), (0, 0, 1.46), color=steel, color2=steel_l, bone='head', mat='metal', sub=2)
    A('box', (0.25, 0.08, 0.085), (0, -0.185, 1.47), color='#120e1a', bone='head', bevel=0.015)
    A('box', (0.07, 0.08, 0.19), (0, -0.19, 1.39), color='#120e1a', bone='head', bevel=0.015)
    for sx in (1, -1):
        A('box', (0.05, 0.03, 0.035), (0.065 * sx, -0.222, 1.47), bone='head', mat='glow_cyan')
        A('box', (0.07, 0.3, 0.14), (0.2 * sx, 0.0, 1.37), color=gold, bone='head', mat='metal', bevel=0.02)
    A('box', (0.05, 0.40, 0.07), (0, 0.0, 1.665), color=gold, bone='head', mat='metal', bevel=0.015)
    for i in range(6):
        t = i / 5
        A('box', (0.075, 0.13, 0.15 - 0.06 * t), (0, -0.08 + 0.085 * i, 1.755 - 0.20 * t * t), color='#f04555', color2='#ff8a70',
          bone='head', bevel=0.02, rot=deg(-25 - 50 * t, 0, 0), jit=0.1)
    # shield on left forearm
    A('cyl', (0.40, 0.40, 0.045), (0.385, 0, 0.80), rot=deg(0, 90, 0), color=steel_d, bone='forearm_L', mat='metal', segs=8)
    A('cyl', (0.32, 0.32, 0.05), (0.40, 0, 0.80), rot=deg(0, 90, 0), color='#b8263a', bone='forearm_L', segs=8)
    A('ico', 0.12, (0.42, 0, 0.80), color=gold, bone='forearm_L', mat='metal', sub=1)
    cape('#c22a40', '#7a1530')

elif style == 'skeleton':
    bone_c, bone_d, rust, dark = '#ece5c9', '#b3a98a', '#8a5f48', '#1c1622'
    A('box', (0.25, 0.13, 0.13), (0, 0, 0.66), color=bone_c, bone='hips', bevel=0.03)
    A('box', (0.2, 0.03, 0.26), (0, -0.08, 0.58), color='#6e1f2a', color2='#3c1020', bone='hips', taper=1.5)
    A('cyl', (0.065, 0.065, 0.5), (0, 0.02, 0.95), color=bone_d, bone='spine', segs=5)
    for z, w in ((0.99, 0.28), (1.08, 0.33), (1.17, 0.34)):
        A('box', (w, 0.22, 0.055), (0, 0, z), color=bone_c, bone='chest', bevel=0.02)
    A('box', (0.06, 0.04, 0.26), (0, -0.11, 1.08), color=bone_c, bone='chest', bevel=0.01)
    A('ico', (0.24, 0.26, 0.16), (0.28, 0, 1.2), color=rust, color2='#b98a6a', bone='upperarm_L', mat='metal', sub=1)
    A('cone', (0.07, 0.07, 0.16), (0.33, 0, 1.3), color=rust, bone='upperarm_L', mat='metal', segs=5, rot=deg(0, 25, 0))
    for s, sx in SIDES:
        A('ico', 0.1, (0.27 * sx, 0, 1.17), color=bone_c, bone='upperarm_' + s, sub=1)
        A('cyl', (0.06, 0.06, 0.24), (0.28 * sx, 0, 1.04), color=bone_c, bone='upperarm_' + s, segs=5)
        A('cyl', (0.055, 0.055, 0.24), (0.295 * sx, 0, 0.8), color=bone_d, bone='forearm_' + s, segs=5)
        A('ico', 0.095, (0.30 * sx, 0, 0.63), color=bone_c, bone='hand_' + s, sub=1)
        A('cyl', (0.07, 0.07, 0.28), (0.11 * sx, 0, 0.48), color=bone_c, bone='thigh_' + s, segs=5)
        A('ico', 0.09, (0.11 * sx, -0.01, 0.34), color=bone_c, bone='shin_' + s, sub=1)
        A('cyl', (0.06, 0.06, 0.27), (0.11 * sx, 0, 0.2), color=bone_d, bone='shin_' + s, segs=5)
        A('box', (0.1, 0.24, 0.06), (0.11 * sx, -0.05, 0.035), color=bone_c, bone='foot_' + s, bevel=0.02)
    A('ico', (0.37, 0.40, 0.35), (0, 0, 1.48), color=bone_c, color2='#fffbe6', bone='head', sub=2)
    A('box', (0.22, 0.17, 0.10), (0, -0.09, 1.31), color=bone_d, bone='head', bevel=0.025)
    for sx in (1, -1):
        A('box', (0.10, 0.06, 0.10), (0.085 * sx, -0.175, 1.48), color=dark, bone='head', bevel=0.02)
        A('ico', 0.045, (0.085 * sx, -0.19, 1.48), bone='head', mat='glow_red', sub=1)
    A('box', (0.04, 0.05, 0.06), (0, -0.195, 1.40), color=dark, bone='head')
    A('cyl', (0.36, 0.38, 0.10), (0, 0.01, 1.63), color=rust, color2='#b98a6a', bone='head', mat='metal', segs=8, taper=0.7)
    A('cone', (0.08, 0.08, 0.18), (0, 0.01, 1.75), color=rust, bone='head', mat='metal', segs=5)
    # rusty sword
    A('box', (0.03, 0.72, 0.085), (-0.30, -0.50, 0.63), color='#9c9488', color2='#c9c2b4', bone='grip_R', mat='metal', bevel=0.01, grad_axis=1)
    A('box', (0.05, 0.05, 0.24), (-0.30, -0.12, 0.63), color=rust, bone='grip_R', mat='metal', bevel=0.01)
    A('cyl', (0.045, 0.045, 0.16), (-0.30, -0.03, 0.63), rot=deg(90, 0, 0), color='#3a2a20', bone='grip_R', segs=5)
    A('cyl', (0.36, 0.36, 0.04), (0.37, 0, 0.80), rot=deg(0, 90, 0), color='#5a3c28', bone='forearm_L', segs=7)
    A('ico', 0.11, (0.40, 0, 0.80), color=rust, bone='forearm_L', mat='metal', sub=1)

else:  # robed: sorcerer / merchant
    boss = style == 'sorcerer'
    robe, robe_d, trim = ('#4a2478', '#1d0f33', '#f0bc45') if boss else ('#7a5634', '#3f2a1a', '#d2a850')
    glow = 'glow_violet' if boss else 'glow_orange'
    hand_c = '#b9a8d8' if boss else '#d8a47c'
    A('cyl', (0.95, 0.95, 0.78), (0, 0, 0.43), color=robe_d, color2=robe, bone='hips', segs=10, taper=0.42, noise_amt=0.05, noise_freq=4)
    A('cyl', (0.42, 0.34, 0.07), (0, 0, 0.80), color=trim, bone='hips', mat='metal', segs=8)
    A('box', (0.34, 0.26, 0.24), (0, 0, 0.91), color=robe, bone='spine', bevel=0.03, taper=1.05)
    A('box', (0.36, 0.27, 0.26), (0, 0, 1.11), color=robe, bone='chest', bevel=0.04, taper=1.25)
    A('box', (0.08, 0.03, 0.42), (0, -0.155, 1.02), color=trim, bone='chest', mat='metal')
    A('cyl', (0.26, 0.26, 0.16), (0, 0.02, 1.29), color=robe_d, bone='chest', segs=8, taper=1.6)
    for s, sx in SIDES:
        if boss:
            A('ico', (0.28, 0.30, 0.2), (0.29 * sx, 0, 1.22), color=trim, color2='#fff0a8', bone='upperarm_' + s, mat='metal', sub=1)
            A('cone', (0.09, 0.09, 0.26), (0.36 * sx, 0, 1.36), color=trim, bone='upperarm_' + s, mat='metal', segs=5, rot=deg(0, 30 * sx, 0))
        else:
            A('ico', (0.2, 0.24, 0.16), (0.27 * sx, 0, 1.2), color=robe_d, bone='upperarm_' + s, sub=1)
        A('cyl', (0.15, 0.15, 0.26), (0.28 * sx, 0, 1.04), color=robe, bone='upperarm_' + s, segs=6)
        A('cyl', (0.27, 0.27, 0.27), (0.295 * sx, 0, 0.80), color=robe_d, color2=robe, bone='forearm_' + s, segs=7, taper=0.5)
        A('ico', 0.11, (0.30 * sx, 0, 0.63), color=hand_c, bone='hand_' + s, sub=1)
    A('ico', (0.46, 0.50, 0.47), (0, 0.02, 1.47), color=robe, color2=mixc(hexc(robe), (1, 1, 1), 0.25), bone='head', sub=2)
    A('ico', (0.33, 0.2, 0.32), (0, -0.16, 1.45), color='#06030c', bone='head', sub=2, jit=0)
    for sx in (1, -1):
        A('ico', (0.075, 0.04, 0.045), (0.075 * sx, -0.255, 1.47), bone='head', mat=glow, sub=1, rot=deg(0, 15 * sx, 0))
    if boss:
        for sx in (1, -1):
            A('cone', (0.13, 0.13, 0.3), (0.21 * sx, 0.02, 1.72), color='#d9ceb0', bone='head', segs=5, rot=deg(0, 35 * sx, 0))
            A('cone', (0.09, 0.09, 0.26), (0.33 * sx, 0.02, 1.9), color='#fff6dc', bone='head', segs=5, rot=deg(0, 5 * sx, 0))
        for x in (-0.1, 0, 0.1):
            A('cone', (0.06, 0.06, 0.16 if x else 0.24), (x, -0.2, 1.7 if x else 1.74), color=trim, bone='head', mat='metal', segs=4)
        cape('#2a1248', '#7a1530', width=0.6)
    else:
        A('box', (0.42, 0.26, 0.46), (0, 0.27, 1.02), color='#5d3b27', bone='chest', bevel=0.05)
        A('cyl', (0.2, 0.2, 0.5), (0, 0.27, 1.34), rot=deg(0, 90, 0), color='#a33b3b', bone='chest', segs=7)
        A('box', (0.12, 0.1, 0.16), (0.14, 0.42, 0.98), color='#8a6a3a', bone='chest', bevel=0.02)
    # staff
    sx0, sy0 = -0.30, -0.10
    A('cyl', (0.05, 0.05, 1.85), (sx0, sy0, 0.93), color='#4a2f22', color2='#7a5236', bone='grip_R', segs=5)
    if boss:
        for a in (-1, 1):
            A('cone', (0.07, 0.07, 0.3), (sx0, sy0 + 0.11 * a, 1.93), color=trim, bone='grip_R', mat='metal', segs=4, rot=deg(18 * a, 0, 0))
        A('ico', 0.2, (sx0, sy0, 1.98), bone='grip_R', mat=glow, sub=2)
    else:
        A('box', (0.04, 0.28, 0.04), (sx0, sy0 - 0.12, 1.82), color='#4a2f22', bone='grip_R')
        A('box', (0.13, 0.13, 0.17), (sx0, sy0 - 0.24, 1.66), bone='grip_R', mat=glow, bevel=0.02)
        A('box', (0.16, 0.16, 0.035), (sx0, sy0 - 0.24, 1.76), color='#2a2a33', bone='grip_R', mat='metal')
        A('box', (0.16, 0.16, 0.035), (sx0, sy0 - 0.24, 1.56), color='#2a2a33', bone='grip_R', mat='metal')

mesh = b.finish()
rig = make_armature('Rig_' + style, BONES)
bind_skin(mesh, rig)


# ------------------------------------------------------------- animation
def legs(tl, sl, tr, sr):
    return {'thigh_L': (tl, 0, 0), 'shin_L': (sl, 0, 0), 'foot_L': (-(tl + sl), 0, 0),
            'thigh_R': (tr, 0, 0), 'shin_R': (sr, 0, 0), 'foot_R': (-(tr + sr), 0, 0)}


def P(*ds, **kw):
    o = {}
    for d in ds:
        o.update(d)
    o.update(kw)
    return o


S, C = math.sin, math.cos
TAU = math.tau

IDLE = P(legs(-12, 16, 14, 10), **{
    'hips@loc': (0, 0, -0.03), 'spine': (4, 0, 0), 'chest': (2, 0, 12), 'head': (-2, 0, -8),
    'upperarm_R': (-32, 12, 0), 'forearm_R': (-62, 0, 0), 'grip_R': (-8, 0, 0),
    'upperarm_L': (12, -14, 0), 'forearm_L': (-48, 0, 0),
    'cape1': (-4, 0, 0), 'cape2': (-3, 0, 0), 'cape3': (-3, 0, 0)})


def idle(t):
    k = S(t * TAU)
    return P(IDLE, **{'hips@loc': (0, 0, -0.03 - 0.014 * (1 + k)), 'chest': (2 + 2.5 * k, 0, 12),
                      'upperarm_R': (-32 - 3 * k, 12, 0), 'upperarm_L': (12, -14 - 2 * k, 0),
                      'head': (-2 - 1.5 * k, 0, -8), 'cape2': (-3 + 3 * k, 0, 0), 'cape3': (-3 + 4 * C(t * TAU), 0, 0)})


def run(t, amp=1.0):
    a = t * TAU
    s, c = S(a), C(a)
    so, co = -s, -c
    return P(legs(-14 - 44 * amp * s, 16 + 78 * amp * max(0, c), -14 - 44 * amp * so, 16 + 78 * amp * max(0, co)), **{
        'hips@loc': (0, 0, -0.07 * amp + 0.06 * amp * abs(s)), 'hips': (0, 0, -7 * amp * s),
        'spine': (6 + 10 * amp, 0, 0), 'chest': (2, 0, 12 * amp * s + 6), 'head': (-8 * amp, 0, -4),
        'upperarm_L': (38 * amp * s - 4, -10, 0), 'forearm_L': (-55 - 15 * amp, 0, 0),
        'upperarm_R': (-22 - 24 * amp * s, 14, 0), 'forearm_R': (-72, 0, 0), 'grip_R': (-6, 0, 0),
        'cape1': (18 + 22 * amp, 0, 0), 'cape2': (12 * amp + 9 * S(2 * a), 0, 0), 'cape3': (10 * amp + 12 * S(2 * a + 1.2), 0, 0)})


def loop(fn, n, step=2, **kw):
    return [(1 + i * step, fn(i / n, **kw)) for i in range(n + 1)]


JUMP = P(legs(-78, 96, 12, 46), **{
    'spine': (-4, 0, 0), 'chest': (0, 0, 10), 'head': (-10, 0, -6),
    'upperarm_R': (-48, 28, 0), 'forearm_R': (-78, 0, 0), 'upperarm_L': (-70, -35, 0), 'forearm_L': (-50, 0, 0),
    'cape1': (10, 0, 0), 'cape2': (14, 0, 0), 'cape3': (16, 0, 0)})
JUMP0 = P(legs(-40, 80, -30, 75), **{'hips@loc': (0, 0, -0.16), 'spine': (16, 0, 0),
                                       'upperarm_R': (20, 14, 0), 'forearm_R': (-70, 0, 0), 'upperarm_L': (30, -14, 0), 'forearm_L': (-40, 0, 0)})


def fall(t):
    k = S(t * TAU)
    return P(legs(-34 + 8 * k, 34, 24 - 8 * k, 56), **{
        'spine': (6, 0, 0), 'chest': (0, 0, 6), 'head': (6, 0, -4),
        'upperarm_R': (-20 + 6 * k, 62, 0), 'forearm_R': (-40, 0, 0), 'grip_R': (-30, 0, 0),
        'upperarm_L': (-24 - 6 * k, -72, 0), 'forearm_L': (-35, 0, 0),
        'cape1': (-70, 0, 0), 'cape2': (-28 + 10 * k, 0, 0), 'cape3': (-20 - 12 * k, 0, 0)})


ATTACK = [
    (1, P(legs(-6, 14, 16, 14), **{'hips@loc': (0, 0.03, -0.04), 'spine': (-10, 0, 0), 'chest': (-4, 0, -28), 'head': (0, 0, 22),
                                    'upperarm_R': (-172, 14, 0), 'forearm_R': (-48, 0, 0), 'grip_R': (-28, 0, 0),
                                    'upperarm_L': (-30, -20, 0), 'forearm_L': (-60, 0, 0), 'cape1': (-10, 0, 0)})),
    (4, P(legs(-26, 24, 22, 14), **{'hips@loc': (0, -0.06, -0.07), 'spine': (6, 0, 0), 'chest': (4, 0, -4), 'head': (0, 0, 4),
                                     'upperarm_R': (-112, 4, 0), 'forearm_R': (-14, 0, 0), 'grip_R': (-4, 0, 0),
                                     'upperarm_L': (10, -24, 0), 'forearm_L': (-50, 0, 0), 'cape1': (14, 0, 0), 'cape2': (10, 0, 0)})),
    (6, P(legs(-44, 40, 30, 12), **{'hips@loc': (0, -0.13, -0.11), 'spine': (20, 0, 0), 'chest': (6, 0, 26), 'head': (-14, 0, -20),
                                     'upperarm_R': (-58, -4, 0), 'forearm_R': (-4, 0, 0), 'grip_R': (30, 0, 0),
                                     'upperarm_L': (40, -26, 0), 'forearm_L': (-40, 0, 0), 'cape1': (30, 0, 0), 'cape2': (18, 0, 0), 'cape3': (14, 0, 0)})),
    (9, P(legs(-44, 42, 30, 14), **{'hips@loc': (0, -0.13, -0.12), 'spine': (24, 0, 0), 'chest': (6, 0, 34), 'head': (-16, 0, -26),
                                     'upperarm_R': (-22, -22, 0), 'forearm_R': (-6, 0, 0), 'grip_R': (52, 0, 0),
                                     'upperarm_L': (46, -26, 0), 'forearm_L': (-40, 0, 0), 'cape1': (22, 0, 0), 'cape2': (20, 0, 0), 'cape3': (24, 0, 0)})),
    (13, IDLE),
]

CROUCH = P(legs(-100, 128, -70, 122), **{
    'hips@loc': (0, 0.02, -0.30), 'spine': (22, 0, 0), 'chest': (6, 0, 14), 'head': (-22, 0, -10),
    'upperarm_R': (-20, 16, 0), 'forearm_R': (-80, 0, 0), 'upperarm_L': (-62, -6, 0), 'forearm_L': (-72, 0, 0),
    'cape1': (-14, 0, 0), 'cape2': (20, 0, 0), 'cape3': (30, 0, 0)})

HURT = [
    (1, IDLE),
    (4, P(legs(-30, 30, 6, 30), **{'hips@loc': (0, 0.1, -0.05), 'spine': (-22, 0, 0), 'chest': (-8, 0, -10), 'head': (-18, 0, 0),
                                    'upperarm_R': (-50, 55, 0), 'forearm_R': (-40, 0, 0), 'upperarm_L': (-40, -60, 0), 'forearm_L': (-40, 0, 0),
                                    'cape1': (-30, 0, 0)})),
    (10, IDLE),
]

DIE = [
    (1, IDLE),
    (6, P(legs(-30, 60, -10, 50), **{'root': (-22, 0, 0), 'hips@loc': (0, 0.05, -0.1), 'spine': (-16, 0, 0), 'head': (-20, 0, 0),
                                      'upperarm_R': (-60, 60, 0), 'forearm_R': (-30, 0, 0), 'upperarm_L': (-60, -60, 0), 'forearm_L': (-30, 0, 0)})),
    (14, P(legs(-20, 30, 10, 20), **{'root': (-88, 0, 0), 'root@loc': (0, 0, 0.16), 'spine': (-4, 0, 0), 'head': (-8, 0, 20),
                                      'upperarm_R': (-20, 80, 0), 'forearm_R': (-20, 0, 0), 'upperarm_L': (-10, -75, 0), 'forearm_L': (-30, 0, 0)})),
    (17, P(legs(-12, 20, 6, 12), **{'root': (-84, 0, 0), 'root@loc': (0, 0, 0.2), 'head': (-4, 0, 20),
                                     'upperarm_R': (-14, 82, 0), 'upperarm_L': (-8, -78, 0)})),
    (22, P(legs(-10, 16, 6, 10), **{'root': (-90, 0, 0), 'root@loc': (0, 0, 0.14), 'head': (-6, 0, 22),
                                     'upperarm_R': (-12, 84, 0), 'upperarm_L': (-6, -80, 0)})),
]


def floaty(t):
    k, k2 = S(t * TAU), C(t * TAU)
    return {'hips@loc': (0, 0, 0.03 * k), 'spine': (5, 0, 0), 'chest': (2 * k, 0, 8), 'head': (4 + 2 * k2, 0, -6),
            'upperarm_R': (-14, 10 + 2 * k, 0), 'forearm_R': (-16, 0, 0),
            'upperarm_L': (-6, -18 - 4 * k, 0), 'forearm_L': (-34 - 6 * k2, 0, 0),
            'cape1': (8 + 5 * k, 0, 0), 'cape2': (6 + 7 * k2, 0, 0), 'cape3': (6 - 8 * k, 0, 0)}


FL = floaty(0)
CAST = [
    (1, FL),
    (9, P(FL, **{'spine': (-12, 0, 0), 'chest': (-6, 0, -16), 'head': (-10, 0, 10),
                 'upperarm_R': (-150, 24, 0), 'forearm_R': (-30, 0, 0), 'upperarm_L': (-120, -40, 0), 'forearm_L': (-50, 0, 0), 'cape1': (-16, 0, 0)})),
    (13, P(FL, **{'spine': (22, 0, 0), 'chest': (8, 0, 18), 'head': (-14, 0, -12), 'hips@loc': (0, -0.08, 0),
                  'upperarm_R': (-84, 6, 0), 'forearm_R': (-6, 0, 0), 'upperarm_L': (-96, -12, 0), 'forearm_L': (-8, 0, 0),
                  'cape1': (36, 0, 0), 'cape2': (22, 0, 0), 'cape3': (18, 0, 0)})),
    (20, P(FL, **{'spine': (18, 0, 0), 'chest': (6, 0, 14), 'head': (-12, 0, -10),
                  'upperarm_R': (-78, 6, 0), 'forearm_R': (-8, 0, 0), 'upperarm_L': (-90, -14, 0), 'forearm_L': (-10, 0, 0), 'cape1': (20, 0, 0)})),
    (28, FL),
]

make_action(rig, 'Idle', loop(idle, 8, 6))
make_action(rig, 'Run', loop(run, 8, 2))
make_action(rig, 'Walk', loop(run, 8, 3, amp=0.5))
make_action(rig, 'Jump', [(1, JUMP0), (5, JUMP), (12, P(JUMP, **legs(-64, 84, 18, 40)))])
make_action(rig, 'Fall', loop(fall, 4, 4))
make_action(rig, 'Attack', ATTACK)
make_action(rig, 'Crouch', [(1, CROUCH), (16, P(CROUCH, **{'spine': (25, 0, 0)})), (31, CROUCH)])
make_action(rig, 'Hurt', HURT)
make_action(rig, 'Die', DIE)
make_action(rig, 'Float', loop(floaty, 8, 8))
make_action(rig, 'Cast', CAST)

export(out)
