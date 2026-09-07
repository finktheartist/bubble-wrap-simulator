"""Author, bake, render and export the Bubble Wrap tool set in a separate Blender process.
Run: Blender --background --factory-startup --python tools/blender/build_toolkit.py
Coordinates in modeling helpers use the game's x/right, y/up, z/toward-viewer convention.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'art'; OUT=ROOT/'outputs/toolkit'; MODELS=ROOT/'public/models'
for d in (ART,OUT,MODELS):d.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
SCENE=bpy.context.scene
SCENE.render.engine='CYCLES';SCENE.cycles.samples=24;SCENE.cycles.use_denoising=True
SCENE.view_settings.view_transform='AgX'
SCENE.world=bpy.data.worlds.new('Neutral product studio');SCENE.world.use_nodes=True
SCENE.world.node_tree.nodes['Background'].inputs[0].default_value=(.42,.46,.5,1)
SCENE.world.node_tree.nodes['Background'].inputs[1].default_value=.65
SCENE.render.image_settings.file_format='PNG';SCENE.render.film_transparent=False
COLLECTION=None

def v(p):return Vector((p[0],-p[2],p[1]))
def active(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj

def own(obj,name,mat=None):
    obj.name=name
    if COLLECTION:
        for c in list(obj.users_collection):c.objects.unlink(obj)
        COLLECTION.objects.link(obj)
    if mat:obj.data.materials.append(mat)
    return obj

def apply(obj,mod):
    active(obj);bpy.ops.object.modifier_apply(modifier=mod.name)

def smooth(obj):
    if obj.type=='MESH':
        for p in obj.data.polygons:p.use_smooth=True
    return obj

def bevel(obj,width=.004,segments=3,weighted=True):
    mod=obj.modifiers.new('Manufactured edge radius','BEVEL');mod.width=width;mod.segments=segments;mod.limit_method='ANGLE';apply(obj,mod)
    smooth(obj)
    if weighted:
        mod=obj.modifiers.new('Face-weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=30;apply(obj,mod)
    return obj

def material(name,color,rough=.5,metal=0,coat=0,grain=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    nodes=m.node_tree.nodes;bs=nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;bs.inputs['Coat Weight'].default_value=coat;bs.inputs['Coat Roughness'].default_value=.18
    if grain:
        tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=grain[0];tex.inputs['Detail'].default_value=3;tex.inputs['Roughness'].default_value=.72
        coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=grain[1]
        m.node_tree.links.new(coord.outputs['Generated'],mapping.inputs[0]);m.node_tree.links.new(mapping.outputs['Vector'],tex.inputs['Vector'])
        ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.2;ramp.color_ramp.elements[0].color=(*[c*.82 for c in color],1);ramp.color_ramp.elements[1].position=.8;ramp.color_ramp.elements[1].color=(*[min(1,c*1.09) for c in color],1)
        m.node_tree.links.new(tex.outputs['Fac'],ramp.inputs[0]);m.node_tree.links.new(ramp.outputs[0],bs.inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.21;bump.inputs['Distance'].default_value=grain[2]
        m.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs[0],bs.inputs['Normal'])
    return m

rubber=material('Rubber | molded charcoal',(.025,.032,.035),.84,grain=(145,(1,1,1),.00035))
endrubber=material('Rubber | worn strike face',(.065,.069,.064),.93,grain=(85,(1,1,1),.00025))
wood=material('Ash | oiled open grain',(.53,.29,.105),.38,coat=.26,grain=(4,(6,6,.055),.00035))
maplewood=material('Maple | natural lacquer',(.7,.47,.24),.32,coat=.44,grain=(5,(9,9,.09),.00018))
leather=material('Leather | warm work glove',(.57,.37,.17),.81,grain=(92,(1,1,1),.00032))
leather2=material('Leather | reinforced suede',(.39,.235,.105),.95,grain=(110,(1,1,1),.00032))
stitch=material('Thread | natural flax',(.8,.68,.44),.96)
seam=material('Seam | shadow',(.075,.058,.035),.95)
fabric=material('Knit | charcoal cuff',(.047,.065,.067),.94,grain=(150,(1,1,1),.0003))
teal=material('Polymer | petrol blue',(.035,.155,.175),.4,coat=.23,grain=(65,(1,1,1),.00012))
tealpaint=material('Enamel | deep teal',(.027,.115,.14),.3,coat=.55,grain=(12,(1,1,1),.00006))
silver=material('Steel | brushed satin',(.48,.52,.55),.31,.98,grain=(80,(1,1,.02),.000025))
steel=material('Steel | blackened hardware',(.066,.078,.085),.38,.92)
brass=material('Brass | aged collar',(.46,.29,.09),.32,.86)
black=material('Cavity | unlit interior',(.005,.007,.008),.99)
labelmat=material('Markings | bone white',(.81,.85,.77),.65)
orange=material('Polymer | safety orange',(.72,.205,.025),.55)
fusemat=material('Cord | braided cotton',(.42,.3,.145),.99,grain=(88,(1,1,1),.0003))
ember=material('Fuse | ember',(.9,.22,.03),.9)
ember.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(1,.085,.005,1)
ember.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=2
resin=material('Resin | midnight pearl',(.018,.036,.09),.16,coat=1)
# Marbling lives in the actual surface and will be baked into the exported atlas.
nd=resin.node_tree.nodes;ln=resin.node_tree.links
co=nd.new('ShaderNodeTexCoord');ns=nd.new('ShaderNodeTexNoise');ns.inputs['Scale'].default_value=2.2;ns.inputs['Detail'].default_value=2;ns.inputs['Roughness'].default_value=.58;ns.inputs['Distortion'].default_value=.85
ln.new(co.outputs['Generated'],ns.inputs['Vector'])
r=nd.new('ShaderNodeValToRGB');r.color_ramp.elements.remove(r.color_ramp.elements[1]);r.color_ramp.elements[0].position=.24;r.color_ramp.elements[0].color=(.004,.009,.026,1)
for pos,col in [(.43,(.012,.025,.065,1)),(.53,(.018,.105,.14,1)),(.57,(.22,.36,.36,1)),(.605,(.4,.49,.45,1)),(.66,(.014,.037,.075,1))]:r.color_ramp.elements.new(pos).color=col
ln.new(ns.outputs['Fac'],r.inputs[0]);ln.new(r.outputs[0],nd['Principled BSDF'].inputs['Base Color'])

def sphere(name,pos,scale,mat,segments=40,rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=v(pos));o=own(bpy.context.object,name,mat);o.scale=(scale[0],scale[2],scale[1]);active(o);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return smooth(o)

def cube(name,pos,size,mat,radius=.006):
    bpy.ops.mesh.primitive_cube_add(size=1,location=v(pos));o=own(bpy.context.object,name,mat);o.scale=(size[0],size[2],size[1]);active(o);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return bevel(o,min(radius,min(size)*.3)) if radius else o

def cylinder(name,pos,radius,depth,mat,axis=(0,1,0),vertices=48,radius2=None,edge=.001):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius if radius2 is None else radius2,radius2=radius,depth=depth,location=v(pos));o=own(bpy.context.object,name,mat);o.rotation_mode='QUATERNION';o.rotation_quaternion=v(axis).to_track_quat('Z','Y');active(o);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return bevel(o,edge,3) if edge else smooth(o)

def torus(name,pos,major,minor,mat,axis=(0,1,0),segments=64):
    bpy.ops.mesh.primitive_torus_add(major_segments=segments,minor_segments=8,location=v(pos),major_radius=major,minor_radius=minor);o=own(bpy.context.object,name,mat);o.rotation_mode='QUATERNION';o.rotation_quaternion=v(axis).to_track_quat('Z','Y');active(o);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);return smooth(o)

def path(name,points,radius,mat,resolution=3):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=resolution;curve.bevel_depth=radius;curve.bevel_resolution=1
    spl=curve.splines.new('BEZIER');spl.bezier_points.add(len(points)-1)
    for p,co in zip(spl.bezier_points,points):p.co=v(co);p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve);COLLECTION.objects.link(obj);obj.data.materials.append(mat);active(obj);bpy.ops.object.convert(target='MESH');return smooth(bpy.context.object)

def lathe(name,profile,mat,segments=64):
    verts=[];faces=[]
    for rad,y in profile:
        for j in range(segments):a=j/segments*math.tau;verts.append(v((rad*math.cos(a),y,rad*math.sin(a))))
    for k in range(len(profile)-1):
        for j in range(segments):a=k*segments+j;b=k*segments+(j+1)%segments;c=b+segments;d=a+segments;faces.append((a,b,c,d))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);COLLECTION.objects.link(o);mesh.materials.append(mat)
    active(o);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');return smooth(o)

def cut(obj,cutter):
    m=obj.modifiers.new('Machined recess','BOOLEAN');m.operation='DIFFERENCE';m.solver='EXACT';m.object=cutter;apply(obj,m);bpy.data.objects.remove(cutter,do_unlink=True)

def join(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;return o

def lettering(name,text,pos,size,mat,side=False):
    curve=bpy.data.curves.new(name,'FONT');curve.body=text;curve.align_x='CENTER';curve.size=size;curve.extrude=.00008;curve.resolution_u=4
    o=bpy.data.objects.new(name,curve);COLLECTION.objects.link(o);o.location=v(pos);curve.materials.append(mat)
    # Text's local XY plane faces game +z, or game +x on a side casing.
    o.rotation_euler=(math.pi/2,0,0)
    if side:o.rotation_euler=(math.pi/2,0,math.pi/2)
    active(o);bpy.ops.object.convert(target='MESH');return bpy.context.object

def conform_sphere(obj,radius):
    active(obj);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for vert in obj.data.vertices:vert.co=vert.co.normalized()*(radius+.0004)
    obj.data.update()
    return obj

def bolt(name,pos,r=.006,axis=(0,0,1)):
    o=cylinder(name,pos,r,.004,steel,axis,32,edge=.0006)
    # Visible milled screwdriver slot, boolean-cut rather than a raised dash.
    if axis==(0,0,1):cut(o,cube('slot cutter',(pos[0],pos[1],pos[2]+.002),(.009,.0015,.003),None,.0003))
    return o

TOOLS=[]
def begin(slug,title):
    global COLLECTION
    COLLECTION=bpy.data.collections.new(title);SCENE.collection.children.link(COLLECTION);TOOLS.append((slug,COLLECTION))

def build_glove():
    begin('fingertip','01 — Stitched work glove')
    bulk=[]
    bulk.append(sphere('Palm volume',(0,-.073,0),(.07,.091,.032),leather,32,20))
    bulk.append(sphere('Knuckle bridge',(.005,-.008,-.005),(.07,.035,.032),leather,32,20))
    bulk.append(sphere('Wrist transition',(0,-.145,0),(.047,.06,.029),leather,32,20))
    def finger(name,points,radii):
        for i,(p,r) in enumerate(zip(points,radii)):bulk.append(sphere(name+' joint '+str(i),p,(r,r,r*.91),leather,24,16))
        for i in range(len(points)-1):
            a,b=Vector(points[i]),Vector(points[i+1]);d=b-a
            bulk.append(cylinder(name+' phalanx',tuple((a+b)/2),radii[i+1],d.length,leather,tuple(d.normalized()),24,radius2=radii[i],edge=0))
    finger('Index',[(-.046,.007,-.003),(-.046,.073,-.016),(-.049,.137,-.048),(-.05,.176,-.074)],[.023,.021,.019,.017])
    for j,(x,y,r) in enumerate([(-.001,.014,.023),(.039,.009,.021),(.071,-.004,.018)]):
        finger(['Middle','Ring','Little'][j],[(x,y,-.006),(x+.002,y+.047,-.025),(x+.002,y+.033,-.067),(x-.004,y-.019,-.074)],[r,r*.95,r*.9,r*.8])
    finger('Thumb',[(-.052,-.105,.002),(-.084,-.067,-.006),(-.1,-.023,-.029),(-.073,.008,-.052)],[.03,.027,.023,.02])
    hand=join(bulk,'Continuous leather glove shell')
    mod=hand.modifiers.new('Fuse anatomical volumes','REMESH');mod.mode='VOXEL';mod.voxel_size=.0021;mod.use_smooth_shade=True;apply(hand,mod)
    mod=hand.modifiers.new('Relax sculpted surface','SMOOTH');mod.factor=.8;mod.iterations=5;apply(hand,mod)
    mod=hand.modifiers.new('Mobile topology','DECIMATE');mod.ratio=.26;apply(hand,mod);smooth(hand)
    # Conform the reinforcement and every stitch to the actual sculpted shell.
    active(hand);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    tree=BVHTree.FromObject(hand,bpy.context.evaluated_depsgraph_get())
    def project(x,y,lift=.001):
        hit,normal,_,_=tree.ray_cast(v((x,y,.3)),Vector((0,1,0)))
        return hit+normal*lift if hit is not None else v((x,y,.025))
    outline=[(-.033,-.137),(-.048,-.095),(-.046,-.057),(-.027,-.029),(.017,-.034),(.043,-.063),(.041,-.114),(.025,-.142)]
    center=Vector((-.002,-.089));edge=[]
    for i in range(len(outline)):
        a=Vector(outline[i]);b=Vector(outline[(i+1)%len(outline)])
        for j in range(6):edge.append(a.lerp(b,j/6))
    verts=[];faces=[];N=len(edge)
    for ring_index in range(7):
        for p in edge:
            xy=center.lerp(p,ring_index/6);verts.append(project(xy.x,xy.y,.0012))
    for i in range(6):
        for j in range(N):faces.append((i*N+j,i*N+(j+1)%N,(i+1)*N+(j+1)%N,(i+1)*N+j))
    me=bpy.data.meshes.new('Tailored suede panel');me.from_pydata(verts,[],faces);me.update()
    patch=bpy.data.objects.new('Tailored suede panel',me);COLLECTION.objects.link(patch);me.materials.append(leather2);smooth(patch)
    def game(p):return(p.x,p.z,-p.y)
    path('Recessed panel seam',[game(project(p.x,p.y,.0015)) for p in edge]+[game(project(edge[0].x,edge[0].y,.0015))],.0006,seam,1)
    for i in range(len(outline)):
        a=Vector(outline[i]);b=Vector(outline[(i+1)%len(outline)]);count=max(2,int((b-a).length/.006))
        for j in range(count):
            p=center.lerp(a.lerp(b,(j+.2)/count),.94);q=center.lerp(a.lerp(b,(j+.6)/count),.94)
            path('Embedded saddle stitch',[game(project(p.x,p.y,.0018)),game(project(q.x,q.y,.0018))],.00042,stitch,1)
    for y,z in [(.067,.001),(.125,-.029)]:path('Index flex crease',[(-.064,y,z),(-.048,y+.003,z+.006),(-.032,y,z)],.0008,leather2)
    for j,x in enumerate([-.001,.039,.071]):path('Curled knuckle crease',[(x-.014,.04-j*.008,-.005),(x,.047-j*.008,-.001),(x+.014,.039-j*.008,-.005)],.0009,leather2)
    cuff=lathe('Open knitted cuff',[(.044,-.229),(.05,-.229),(.052,-.214),(.05,-.168),(.044,-.16),(.04,-.166),(.041,-.221),(.044,-.229)],fabric,56)
    for i in range(32):
        a=i/32*math.tau;path('Knit cuff rib',[(math.cos(a)*.05,-.222,math.sin(a)*.05),(math.cos(a)*.051,-.181,math.sin(a)*.051)],.0012,fabric,2)
    cube('Woven cuff label',(0,-.193,.052),(.035,.023,.002),teal,.002)
    lettering('Glove size mark','M',(0,-.2,.0535),.012,labelmat)

def build_mallet():
    begin('mallet','02 — Rubber and ash mallet')
    shaft=lathe('Tapered ash handle',[(.001,-.365),(.022,-.365),(.026,-.356),(.027,-.32),(.023,-.24),(.018,-.07),(.019,.15),(.024,.22),(.001,.22)],wood,56)
    # Rubber barrel formed along X, with concave strike faces and a central parting line.
    head=lathe('One-piece molded mallet head',[(.001,-.188),(.07,-.188),(.087,-.195),(.098,-.187),(.103,-.169),(.102,-.151),(.095,-.1),(.091,-.03),(.092,0),(.091,.03),(.095,.1),(.102,.151),(.103,.169),(.098,.187),(.087,.195),(.07,.188),(.001,.188)],rubber,64)
    head.rotation_euler.y=math.pi/2;head.location=v((0,.183,0));active(head);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    torus('Mold parting seam',(0,.183,0),.092,.00065,endrubber,(1,0,0))
    for x in [-.192,.192]:
        cylinder('Recessed strike face',(x,.183,0),.079,.004,endrubber,(1,0,0),64,edge=.0007)
        torus('Strike-face molded groove',(x*1.006,.183,0),.072,.0006,rubber,(1,0,0))
    cylinder('Handle ferrule',(0,.073,0),.022,.023,steel,vertices=48,edge=.001)
    # Tiny genuine blind hole for a hanging cord at the end of the handle.
    cutter=cylinder('lanyard drill',(0,-.333,0),.005,.075,None,(0,0,1),32,edge=0);cut(shaft,cutter)
    lettering('Head weight marking','16 OZ',(0,.162,.094),.024,labelmat)
    lettering('Handle maker stamp','BWRP',(0,-.198,.021),.012,steel)

def build_bat():
    begin('bat','03 — Turned maple bat')
    bat=lathe('Continuous turned maple',[(.001,-.48),(.024,-.48),(.029,-.476),(.03,-.468),(.027,-.46),(.017,-.454),(.0145,-.442),(.014,-.33),(.0145,-.22),(.017,-.105),(.02,.005),(.025,.13),(.033,.26),(.038,.34),(.039,.422),(.037,.456),(.027,.477),(.01,.486),(.001,.487)],maplewood,72)
    # A real shallow cupped end leaves the lip intact.
    cut(bat,sphere('Cupped barrel cutter',(0,.5,0),(.024,.027,.024),None,48,24))
    cylinder('Grip tape sleeve',(0,-.341,0),.0157,.194,rubber,vertices=48,radius2=.0152,edge=.0007)
    # Thin tape seam, no thick rope wrapped around the handle.
    p=[]
    for i in range(241):
        t=i/240;a=t*math.tau*10;p.append((math.cos(a)*.01595,-.436+t*.19,math.sin(a)*.01595))
    path('Overlapping grip tape edge',p,.00035,endrubber,1)
    torus('Top binding edge',(0,-.243,0),.0157,.001,rubber)
    lettering('Burned barrel emblem','BWRP',(0,.205,.031),.016,steel)
    lettering('Wood specification','MAPLE',(0,.176,.03),.008,steel)

def build_ball():
    begin('bowling-ball','04 — Drilled pearl resin ball')
    ball=sphere('Resin shell with boolean-drilled wells',(0,0,0),(.28,.28,.28),resin,96,64);ball.data.materials.append(black)
    directions=[Vector((-.19,.32,.93)).normalized(),Vector((.19,.32,.93)).normalized(),Vector((0,-.115,.994)).normalized()]
    for i,n in enumerate(directions):
        radius=.027 if i<2 else .034
        center=n*.237;c=cylinder('Finger-well drill '+str(i),tuple(center),radius,.16,None,tuple(n),64,edge=0)
        c.data.materials.append(resin);c.data.materials.append(black)
        for p in c.data.polygons:p.material_index=1
        cut(ball,c)
    bevel(ball,.0015,3,False)
    # Polished resin remains continuous through a subtle chamfer at each well.
    conform_sphere(lettering('Ball weight engraving','7 KG',(0,-.148,.238),.023,labelmat),.28)
    conform_sphere(lettering('Ball edition engraving','PEARL  /  01',(0,-.18,.21),.01,labelmat),.28)

def extrude_side(name,outline,width,mat,center_x=0,radius=.01):
    verts=[v((x+center_x,y,z)) for x in [-width/2,width/2] for y,z in outline];n=len(outline)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    for i in range(n):j=(i+1)%n;faces.append((i,j,n+j,n+i))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);COLLECTION.objects.link(o);me.materials.append(mat)
    active(o);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');return bevel(o,radius,4)

def build_blaster():
    begin('pop-blaster','05 — Pneumatic pop blaster')
    outline=[(.09,-.26),(.136,-.19),(.133,.157),(.08,.21),(-.027,.192),(-.065,.06),(-.061,-.195),(-.015,-.26)]
    shell=extrude_side('Contoured molded housing',outline,.15,teal,radius=.019)
    # Center gasket follows the actual casing outline.
    for x in [-.076,.076]:
        inset=[(.075,-.215),(.102,-.162),(.1,.126),(.065,.154),(-.007,.139),(-.025,-.14)]
        plate=extrude_side('Recessed side panel',inset,.009,rubber,center_x=x,radius=.008)
        for j in range(4):
            cut(plate,cube('Vent slot cutter',(x,.017,-.143+j*.038),(.023,.041,.01),None,.003))
        for z in [-.182,.125]:cylinder('Case fastener',(x+math.copysign(.008,x),.071,z),.007,.004,steel,(1,0,0),32,edge=.0006)
    grip=extrude_side('Angled ergonomic handle',[(-.04,.054),(-.065,-.03),(-.248,.026),(-.286,.095),(-.251,.151),(-.102,.153)],.09,rubber,radius=.018)
    for j in range(5):
        y=-.105-j*.029;z=.015+(j*.008)
        path('Grip molded checkering',[(-.043,y,z),(-.025,y-.003,z+.003),(.025,y-.003,z+.003),(.043,y,z)],.0011,endrubber,2)
    # The trigger guard has an open middle, and the trigger sits inside it.
    path('Open metal trigger guard',[(-.006,-.047,-.179),(-.006,-.14,-.18),(-.006,-.182,-.125),(-.006,-.163,-.014)],.007,steel,8)
    trig=extrude_side('Pivoting orange trigger',[(-.057,-.108),(-.104,-.114),(-.133,-.075),(-.115,-.061),(-.075,-.085)],.02,orange,radius=.004)
    cylinder('Barrel collar',(0,.03,-.263),.058,.066,steel,(0,0,1),64,edge=.003)
    barrel=lathe('Hollow machined barrel',[(.034,-.115),(.044,-.115),(.047,-.107),(.047,.107),(.044,.115),(.034,.115),(.034,-.115)],silver,64)
    barrel.rotation_euler.x=math.pi/2;barrel.location=v((0,.03,-.404));active(barrel);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    cylinder('Dark barrel depth',(0,.03,-.334),.034,.004,black,(0,0,1),48,edge=0)
    torus('Orange safety muzzle',(0,.03,-.52),.043,.005,orange,(0,0,1))
    for z in [-.3,-.32]:torus('Barrel retaining groove',(0,.03,z),.047,.0011,steel,(0,0,1))
    cube('Sight dovetail',(0,.146,-.028),(.036,.017,.097),steel,.003)
    cube('Front sight',(0,.16,-.096),(.017,.022,.014),teal,.003)
    cube('Sight insert',(0,.171,-.087),(.004,.006,.002),labelmat,.001)
    lettering('Housing serial','POP / 01',(.082,.096,-.025),.016,labelmat,side=True)
    cylinder('Grip air fitting',(0,-.278,.099),.009,.02,brass,vertices=6,edge=.001)

def build_bomb():
    begin('pop-bomb','06 — Enamel pop bomb')
    sphere('Enamel body',(0,0,0),(.19,.19,.19),tealpaint,64,40)
    torus('Recessed hemisphere gasket',(0,0,0),.189,.0018,black)
    for y in [-.003,.003]:torus('Rolled enamel seam lip',(0,y,0),.1898,.0008,tealpaint)
    cylinder('Machined neck',(0,.192,0),.054,.06,steel,vertices=48,edge=.002)
    cylinder('Hexagonal fuse gland',(0,.231,0),.042,.022,brass,vertices=6,edge=.002)
    for i in range(4):torus('Visible collar thread',(0,.198+i*.006,0),.054,.0015,silver)
    cylinder('Ceramic fuse seat',(0,.249,0),.015,.012,labelmat,vertices=40,edge=.001)
    points=[(0,.251,0),(.006,.277,-.004),(.03,.30,-.003),(.038,.33,-.014)]
    path('Cotton fuse core',points,.006,fusemat,8)
    for k in range(3):
        p=[]
        for i in range(91):
            t=i/90;a=t*math.tau*8+k*math.tau/3;p.append((.038*t+math.cos(a)*.0055,.253+t*.077,-.014*t+math.sin(a)*.0055))
        path('Braided fuse strand',p,.0011,stitch,1)
    sphere('Charred fuse end',(.038,.33,-.014),(.006,.007,.006),black,20,12)
    sphere('Glowing fuse tip',(.038,.335,-.014),(.0035,.0035,.0035),ember,16,10)
    conform_sphere(lettering('Bomb stamped lettering','POP',(0,.035,.188),.033,labelmat),.19)
    conform_sphere(lettering('Bomb series','NO. 06',(0,.011,.19),.009,labelmat),.19)
    for x in [-.07,.07]:bolt('Flush body screw',(x,.082,.155),.004)

for build in [build_glove,build_mallet,build_bat,build_ball,build_blaster,build_bomb]:
    print('BUILD',build.__name__,flush=True);build()

# Pack each tool into a single UV atlas, retaining the distinct PBR material responses.
# Base color and tangent normals are baked, so the browser receives the same finish.
manifest=[]
for index,(slug,col) in enumerate(TOOLS):
    print('BAKE',slug,flush=True)
    meshes=[o for o in col.objects if o.type=='MESH'];obj=join(meshes,slug)
    active(obj);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    tri=obj.modifiers.new('Final render triangles','TRIANGULATE');apply(obj,tri)
    # Material copies isolate each tool's atlas links from the other tools.
    copies={}
    for slot in obj.material_slots:
        original=slot.material or black
        if original not in copies:copies[original]=original.copy()
        slot.material=copies[original]
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(60),island_margin=.008);bpy.ops.object.mode_set(mode='OBJECT')
    size=768 if slug in ['fingertip','bowling-ball'] else 512
    base=bpy.data.images.new(slug+' • baked color',width=size,height=size,alpha=False)
    base.colorspace_settings.name='sRGB'
    normal=bpy.data.images.new(slug+' • baked normal',width=size,height=size,alpha=False);normal.colorspace_settings.name='Non-Color'
    for mat in obj.data.materials:
        n=mat.node_tree.nodes.new('ShaderNodeTexImage');n.image=base;mat.node_tree.nodes.active=n
    SCENE.cycles.samples=4;SCENE.render.bake.margin=8;SCENE.render.bake.use_clear=True
    # Hide other tools in the bake but preserve them in the saved library.
    for _,other in TOOLS:other.hide_render=other!=col
    # Bake the base-color signal through emission. Diffuse baking would turn metal black.
    emit_nodes=[]
    for mat in obj.data.materials:
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF');output=nodes.get('Material Output')
        emission=nodes.new('ShaderNodeEmission');emission.inputs['Color'].default_value=bs.inputs['Base Color'].default_value
        if bs.inputs['Base Color'].is_linked:links.new(bs.inputs['Base Color'].links[0].from_socket,emission.inputs['Color'])
        links.new(emission.outputs[0],output.inputs['Surface']);emit_nodes.append((mat,emission))
    bpy.ops.object.bake(type='EMIT')
    for mat,emission in emit_nodes:
        mat.node_tree.links.new(mat.node_tree.nodes['Principled BSDF'].outputs[0],mat.node_tree.nodes['Material Output'].inputs['Surface'])
        mat.node_tree.nodes.remove(emission)
    base.pack()
    for mat in obj.data.materials:
        n=mat.node_tree.nodes.new('ShaderNodeTexImage');n.image=normal;mat.node_tree.nodes.active=n
    bpy.ops.object.bake(type='NORMAL');normal.pack()
    for mat in obj.data.materials:
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
        color_node=nodes.new('ShaderNodeTexImage');color_node.image=base;links.new(color_node.outputs['Color'],bs.inputs['Base Color'])
        norm_node=nodes.new('ShaderNodeTexImage');norm_node.image=normal;norm_node.interpolation='Linear'
        tangent=nodes.new('ShaderNodeNormalMap');links.new(norm_node.outputs['Color'],tangent.inputs['Color']);links.new(tangent.outputs['Normal'],bs.inputs['Normal'])
    active(obj)
    bpy.ops.export_scene.gltf(filepath=str(MODELS/(slug+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_image_format='AUTO',export_materials='EXPORT',export_cameras=False,export_lights=False)
    bound=[obj.matrix_world@Vector(p) for p in obj.bound_box]
    manifest.append({'tool':index,'file':slug+'.glb','triangles':len(obj.data.polygons),'vertices':len(obj.data.vertices),'materials':len(obj.data.materials),'bytes':(MODELS/(slug+'.glb')).stat().st_size,'source':'art/bubble-wrap-tools.blend'})
for _,col in TOOLS:col.hide_render=False
(MODELS/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# A saved, editable library with six distinct collections, and independent studio renders.
COLLECTION=None
SCENE.cycles.samples=32
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1))
floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(material('Studio | neutral mist',(.45,.49,.5),.77))
bpy.ops.object.camera_add(location=(1.2,-3,1.15));camera=bpy.context.object;camera.name='Product camera';SCENE.camera=camera;camera.data.type='ORTHO'
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,location,energy,size,target):
    bpy.ops.object.light_add(type='AREA',location=location);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;aim(o,target)
area('Large warm key',(-2,-3,4),360,3,(0,0,0));area('Cool edge softbox',(2,1,2.4),450,2,(0,0,0));area('Front fill',(0,-3,.1),55,2,(0,0,0))
SCENE.render.resolution_x=720;SCENE.render.resolution_y=720;SCENE.render.resolution_percentage=100
for index,(slug,col) in enumerate(TOOLS):
    for _,other in TOOLS:other.hide_render=other!=col
    obj=next(o for o in col.objects if o.type=='MESH')
    bounds=[obj.matrix_world@Vector(p) for p in obj.bound_box];center=sum(bounds,Vector())/8
    height=max(p.z for p in bounds)-min(p.z for p in bounds);width=max(p.x for p in bounds)-min(p.x for p in bounds);depth=max(p.y for p in bounds)-min(p.y for p in bounds)
    extent=max(height,width,depth)
    floor.location.z=min(p.z for p in bounds)-.008
    camera.data.ortho_scale=extent*1.48
    camera.location=center+Vector((extent*(1.7 if slug=='pop-blaster' else .85),-extent*3.5,extent*.9));aim(camera,center)
    SCENE.render.filepath=str(OUT/(slug+'.png'));print('RENDER',slug,flush=True);bpy.ops.render.render(write_still=True)
# Arrange linked copies for review; original export collections retain unit scale and origin.
preview=bpy.data.collections.new('00 — Toolkit presentation (linked copies)');SCENE.collection.children.link(preview)
for index,(slug,col) in enumerate(TOOLS):
    col.hide_render=True;col.hide_viewport=True
    source=next(o for o in col.objects if o.type=='MESH');obj=source.copy();obj.data=source.data;obj.name='Review / '+slug;preview.objects.link(obj)
    bounds=[Vector(p) for p in obj.bound_box]
    height=max(p.z for p in bounds)-min(p.z for p in bounds);scale=.9/max(height,obj.dimensions.x,obj.dimensions.y)
    obj.scale=(scale,)*3;obj.location=((index%3-1)*1.35,0 if index<3 else 1.3,-min(p.z for p in bounds)*scale)
    source['game_asset']=str(MODELS/(slug+'.glb'));source['export_origin']='Unit scale, origin preserved; GLB exports game Y up'
floor.location.z=-.01
camera.location=(1.6,-6.7,5.4);camera.data.ortho_scale=5.6;aim(camera,(0,.5,.35))
SCENE.render.resolution_x=1600;SCENE.render.resolution_y=1000;SCENE.render.filepath=str(OUT/'toolkit-overview.png');bpy.ops.render.render(write_still=True)
# Opening this file presents the new toolkit, without touching any previously open project.
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_distance=5;a.spaces.active.region_3d.view_location=(0,.5,.4);a.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'bubble-wrap-tools.blend'))
print('TOOLKIT_READY',json.dumps(manifest),flush=True)
