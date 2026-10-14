"""Shared helpers for procedurally modelling EMBERFALL assets in Blender (headless).

Everything is built with bmesh into a single mesh per object, coloured with a
corner colour attribute ("Col") so one material can cover a whole model.
"""
import bpy, bmesh, math, random
from mathutils import Matrix, Vector, Euler, Quaternion, noise

MATS = {}


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def mixc(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    make_materials()


def _principled(m):
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is None:
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    return nt, b


def make_materials():
    def mk(name, metallic=0.0, rough=0.85, emit=None, estr=0.0, vcol=True):
        m = bpy.data.materials.new(name)
        nt, b = _principled(m)
        b.inputs['Metallic'].default_value = metallic
        b.inputs['Roughness'].default_value = rough
        if vcol:
            vc = nt.nodes.new('ShaderNodeVertexColor')
            vc.layer_name = 'Col'
            nt.links.new(vc.outputs['Color'], b.inputs['Base Color'])
        if emit:
            c = hexc(emit)
            b.inputs['Base Color'].default_value = (*c, 1)
            b.inputs['Emission Color'].default_value = (*c, 1)
            b.inputs['Emission Strength'].default_value = estr
        MATS[name] = m

    mk('matte')
    mk('metal', metallic=1.0, rough=0.38)
    mk('gloss', metallic=0.0, rough=0.25)
    for n, c in dict(cyan='#59e8ff', orange='#ffa238', red='#ff3b2f', violet='#b56bff',
                     green='#7dff8a', gold='#ffd85a', white='#ffffff', pink='#ff6ad5').items():
        mk('glow_' + n, emit=c, estr=3.0, vcol=False, rough=0.5)
    for n, c in dict(crystal_cyan='#3fd6ff', crystal_violet='#a45cff', crystal_pink='#ff5fb0', heart='#ff2f4a',
                     shrine_gem='#59e8ff', portal_rune='#59e8ff', lava_rock='#ff5a1f').items():
        mk(n, emit=c, estr=1.0, vcol=False, rough=0.2)


def deg(*a):
    return tuple(math.radians(x) for x in a)


class Builder:
    """Accumulates coloured primitives into one bmesh."""

    def __init__(self, name, bones=None, seed=1):
        self.name = name
        self.bm = bmesh.new()
        self.bm.loops.layers.color.new('Col')
        self.bm.verts.layers.deform.verify()
        self.bones = list(bones or [])
        self.mats = []
        self.rng = random.Random(seed)

    def _mat(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def _merge(self, tbm):
        """Each part is built in its own bmesh, then appended (keeps element sets unambiguous)."""
        me = bpy.data.meshes.new('_tmp')
        tbm.to_mesh(me)
        tbm.free()
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)

    def _paint(self, tbm, col, faces, c1, c2, mi, jit, grad_axis, smooth, bone):
        if c2:
            zs = [v.co[grad_axis] for v in tbm.verts]
            z0, z1 = min(zs), max(zs)
        for f in faces:
            c = c1
            if c2:
                t = (f.calc_center_median()[grad_axis] - z0) / max(1e-6, z1 - z0)
                c = mixc(c1, c2, t)
            j = 1 + self.rng.uniform(-jit, jit)
            cc = (min(1, c[0] * j), min(1, c[1] * j), min(1, c[2] * j), 1)
            for l in f.loops:
                l[col] = cc
            f.material_index = mi
            f.smooth = smooth
        if bone is not None:
            dl = tbm.verts.layers.deform.verify()
            gi = self.bones.index(bone)
            for v in tbm.verts:
                v[dl][gi] = 1.0

    def add(self, kind, size=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0), color='#888888', color2=None,
            bone=None, mat='matte', bevel=0.0, taper=1.0, segs=8, sub=1, shape=None, jit=0.05,
            noise_amt=0.0, noise_freq=2.0, smooth=False, grad_axis=2):
        bm = bmesh.new()
        if kind == 'box':
            bmesh.ops.create_cube(bm, size=1.0)
        elif kind == 'ico':
            bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=0.5)
        elif kind == 'cyl':
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=0.5, radius2=0.5, depth=1.0)
        elif kind == 'cone':
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=0.5, radius2=0.0005, depth=1.0)
        else:
            raise ValueError(kind)
        if isinstance(size, (int, float)):
            size = (size, size, size)
        tx, ty = taper if isinstance(taper, tuple) else (taper, taper)
        for v in bm.verts:
            if v.co.z > 0:
                v.co.x *= tx
                v.co.y *= ty
            v.co.x *= size[0]
            v.co.y *= size[1]
            v.co.z *= size[2]
            if shape:
                v.co = Vector(shape(v.co.copy()))
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, profile=0.5, affect='EDGES')
        if noise_amt:
            off = Vector((self.rng.uniform(0, 50), self.rng.uniform(0, 50), self.rng.uniform(0, 50)))
            for v in bm.verts:
                n = noise.noise(v.co * noise_freq + off)
                d = v.co.normalized() if v.co.length > 1e-6 else Vector((0, 0, 1))
                v.co += d * n * noise_amt
        M = Matrix.Translation(loc) @ Euler(rot, 'XYZ').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=M, verts=list(bm.verts))
        col = bm.loops.layers.color.new('Col')
        c1 = hexc(color) if isinstance(color, str) else color
        c2 = (hexc(color2) if isinstance(color2, str) else color2) if color2 else None
        self._paint(bm, col, list(bm.faces), c1, c2, self._mat(mat), jit, grad_axis, smooth, bone)
        self._merge(bm)

    def poly(self, pts, color='#888888', bone=None, mat='matte', jit=0.05, double=True):
        """Single n-gon from a list of points (optionally double sided)."""
        bm = bmesh.new()
        col = bm.loops.layers.color.new('Col')
        c = hexc(color) if isinstance(color, str) else color
        for order in ([pts, list(reversed(pts))] if double else [pts]):
            bm.faces.new([bm.verts.new(p) for p in order])
        self._paint(bm, col, list(bm.faces), c, None, self._mat(mat), jit, 2, False, bone)
        self._merge(bm)

    def finish(self, loc=(0, 0, 0)):
        self.bm.normal_update()
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        for m in self.mats:
            me.materials.append(MATS[m])
        for b in self.bones:
            ob.vertex_groups.new(name=b)
        try:
            me.color_attributes.active_color_index = 0
            me.color_attributes.render_color_index = 0
        except Exception:
            pass
        ob.location = loc
        return ob


# ---------------------------------------------------------------- armature
def make_armature(name, bones):
    """bones: list of (name, head, tail, parent)"""
    arm = bpy.data.armatures.new(name)
    ao = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    ao.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for n, head, tail, parent in bones:
        eb = arm.edit_bones.new(n)
        eb.head = head
        eb.tail = tail
        eb.roll = 0
        if parent:
            eb.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ao.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return ao


def bind_skin(ob, ao):
    ob.parent = ao
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = ao


def _arm_quat(rx, ry, rz):
    return (Quaternion((0, 0, 1), math.radians(rz)) @ Quaternion((0, 1, 0), math.radians(ry))
            @ Quaternion((1, 0, 0), math.radians(rx)))


def set_pose(ao, pose):
    """pose: {bone: (rx,ry,rz) degrees about ARMATURE rest axes, 'bone@loc': (x,y,z) armature-space offset}"""
    for pb in ao.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector((0, 0, 0))
    for k, v in pose.items():
        if k.endswith('@loc'):
            pb = ao.pose.bones[k[:-4]]
            R = pb.bone.matrix_local.to_3x3()
            pb.location = R.inverted() @ Vector(v)
        else:
            pb = ao.pose.bones[k]
            Rq = pb.bone.matrix_local.to_quaternion()
            pb.rotation_quaternion = Rq.inverted() @ _arm_quat(*v) @ Rq


def make_action(ao, name, keys):
    """keys: list of (frame, pose). Every bone is keyed on every key."""
    act = bpy.data.actions.new(name)
    ad = ao.animation_data_create()
    ad.action = act
    for frame, pose in keys:
        set_pose(ao, pose)
        for pb in ao.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=frame)
            pb.keyframe_insert('location', frame=frame)
    slot = getattr(ad, 'action_slot', None)
    ad.action = None
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, 1, act)
    try:
        if slot is not None and getattr(st, 'action_slot', None) is None:
            st.action_slot = slot
    except Exception as e:
        print('slot assign failed', e)
    tr.mute = False
    set_pose(ao, {})
    return act


def export(path):
    kw = dict(filepath=path, export_format='GLB', export_yup=True, export_animations=True,
              export_animation_mode='NLA_TRACKS', export_skins=True)
    for extra in (dict(export_vertex_color='MATERIAL'), {}):
        try:
            bpy.ops.export_scene.gltf(**kw, **extra)
            break
        except TypeError as e:
            print('export retry', e)
    print('EXPORTED', path)
