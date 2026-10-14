import fs from 'fs';
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f); const l = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + l)); const acc = j.accessors;
  console.log('==', f, (b.length / 1024 | 0) + 'kB');
  console.log(' nodes:', j.nodes.filter(n => n.mesh !== undefined).map(n => n.name).join(' '));
  console.log(' prims:', j.meshes.map(m => m.primitives.map(p => (p.attributes.COLOR_0 !== undefined ? 'C' : '-') + (p.attributes.JOINTS_0 !== undefined ? 'J' : '-') + ':' + j.materials[p.material]?.name).join(',')).slice(0, 6).join(' | '));
  if (j.animations) console.log(' anims:', j.animations.map(a => a.name + '(' + acc[a.samplers[0].input].max[0].toFixed(2) + 's)').join(' '));
}
