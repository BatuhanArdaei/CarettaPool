"""
Havuz şablonu export scripti (Blender 4.x)

Kullanım:
  1. .blend dosyasını kaydedin (çıktı, dosyanın yanındaki pool_template/ klasörüne yazılır).
  2. Sahnede:
     - Adı "CAM_" ile başlayan kamera(lar)  (yoksa sahnenin aktif kamerası kullanılır)
     - Adı "POOL_AREA" olan düz bir plane (havuzun konulabileceği maksimum alan)
     - Bir adet Sun ışığı
  3. Scripting sekmesinde bu dosyayı açıp "Run Script".

Her kamera için scene_<kamera_adı>.json üretilir. Koordinatlar three.js
sistemine (Y yukarı, metre) çevrilmiştir.
"""

import bpy
import json
import math
import os
from mathutils import Quaternion, Vector

# Blender (Z yukarı) -> three.js (Y yukarı): X ekseninde -90 derece
AXIS_Q = Quaternion((math.sqrt(0.5), -math.sqrt(0.5), 0.0, 0.0))


def to_three_vec(v):
    return [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]


def to_three_quat(q):
    t = AXIS_Q @ q
    return [round(t.x, 6), round(t.y, 6), round(t.z, 6), round(t.w, 6)]


def vertical_fov(cam_data, scene):
    r = scene.render
    w = r.resolution_x * r.pixel_aspect_x
    h = r.resolution_y * r.pixel_aspect_y
    fit = cam_data.sensor_fit
    if fit == "AUTO":
        sensor = cam_data.sensor_width
        fit = "HORIZONTAL" if w >= h else "VERTICAL"
    elif fit == "HORIZONTAL":
        sensor = cam_data.sensor_width
    else:
        sensor = cam_data.sensor_height

    if fit == "HORIZONTAL":
        hfov = 2 * math.atan(sensor / (2 * cam_data.lens))
        return math.degrees(2 * math.atan(math.tan(hfov / 2) * h / w))
    return math.degrees(2 * math.atan(sensor / (2 * cam_data.lens)))


def export_camera(cam_obj, scene):
    data = cam_obj.data
    if data.type != "PERSP":
        raise Exception(f"{cam_obj.name}: kamera tipi Perspective olmalı")
    if abs(data.shift_x) > 1e-4 or abs(data.shift_y) > 1e-4:
        raise Exception(f"{cam_obj.name}: Lens Shift X/Y 0 olmalı")

    mw = cam_obj.matrix_world
    return {
        "name": cam_obj.name,
        "position": to_three_vec(mw.to_translation()),
        "quaternion": to_three_quat(mw.to_quaternion()),
        "fov": round(vertical_fov(data, scene), 4),
        "near": round(data.clip_start, 4),
        "far": round(data.clip_end, 2),
    }


def export_pool_area():
    obj = bpy.data.objects.get("POOL_AREA")
    if obj is None:
        raise Exception('"POOL_AREA" adlı plane bulunamadı')
    mw = obj.matrix_world
    return {
        "center": to_three_vec(mw.to_translation()),
        "rotationY": round(mw.to_euler().z, 6),
        "maxLength": round(obj.dimensions.x, 3),
        "maxWidth": round(obj.dimensions.y, 3),
    }


def export_sun():
    suns = [o for o in bpy.data.objects if o.type == "LIGHT" and o.data.type == "SUN"]
    if not suns:
        raise Exception("Sahnede Sun ışığı bulunamadı")
    sun = suns[0]
    to_light = (sun.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))).normalized()
    return {
        "direction": to_three_vec(to_light),
        "strength": round(sun.data.energy, 4),
        "color": [round(c, 4) for c in sun.data.color],
        "angle": round(math.degrees(sun.data.angle), 4),
    }


def main():
    if not bpy.data.filepath:
        raise Exception("Önce .blend dosyasını kaydedin")

    scene = bpy.context.scene
    cams = [o for o in scene.objects if o.type == "CAMERA" and o.name.startswith("CAM_")]
    if not cams:
        if scene.camera is None:
            raise Exception("Sahnede kamera yok")
        cams = [scene.camera]

    out_dir = bpy.path.abspath("//pool_template/")
    os.makedirs(out_dir, exist_ok=True)

    common = {
        "version": 1,
        "units": "meters",
        "coordinateSystem": "three-y-up",
        "resolution": [scene.render.resolution_x, scene.render.resolution_y],
        "viewTransform": scene.view_settings.view_transform,
        "exposure": scene.view_settings.exposure,
        "poolArea": export_pool_area(),
        "sun": export_sun(),
    }

    for cam in cams:
        payload = dict(common, camera=export_camera(cam, scene))
        path = os.path.join(out_dir, f"scene_{bpy.path.clean_name(cam.name)}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"Yazıldı: {path}")


main()
