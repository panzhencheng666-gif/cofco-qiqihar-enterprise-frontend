import argparse
import json
import math
import pathlib
import sys
import traceback
from datetime import datetime, timezone

import bpy


EARTH_RADIUS_M = 6_378_137.0
EXPECTED_REGIONS = [
    ("230200", "齐齐哈尔市", (0.045, 0.30, 0.26, 1.0)),
    ("231100", "黑河市", (0.035, 0.23, 0.31, 1.0)),
    ("150700", "呼伦贝尔市", (0.09, 0.36, 0.30, 1.0)),
    ("232700", "大兴安岭地区", (0.055, 0.27, 0.22, 1.0)),
]


def script_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--manifest", required=True)
    return parser.parse_args(arguments)


def mercator_meters(longitude: float, latitude: float) -> tuple[float, float]:
    longitude_radians = math.radians(longitude)
    clamped_latitude = max(-85.05112878, min(85.05112878, latitude))
    latitude_radians = math.radians(clamped_latitude)
    return (
        EARTH_RADIUS_M * longitude_radians,
        EARTH_RADIUS_M * math.log(math.tan(math.pi / 4.0 + latitude_radians / 2.0)),
    )


def geometry_rings(geometry: dict) -> list[list[list[float]]]:
    if geometry.get("type") == "Polygon":
        return list(geometry.get("coordinates", []))
    if geometry.get("type") == "MultiPolygon":
        return [ring for polygon in geometry.get("coordinates", []) for ring in polygon]
    raise ValueError(f"unsupported geometry={geometry.get('type')}")


def all_coordinates(features: list[dict]):
    for feature in features:
        for ring in geometry_rings(feature["geometry"]):
            for coordinate in ring:
                yield float(coordinate[0]), float(coordinate[1])


def make_material(name: str, color: tuple[float, float, float, float]):
    material = bpy.data.materials.new(name=name)
    material.diffuse_color = color
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Metallic"].default_value = 0.18
        principled.inputs["Roughness"].default_value = 0.38
        emission = principled.inputs.get("Emission Color")
        if emission is not None:
            emission.default_value = (color[0] * 0.3, color[1] * 0.4, color[2] * 0.45, 1.0)
        strength = principled.inputs.get("Emission Strength")
        if strength is not None:
            strength.default_value = 0.08
    return material


def make_region_object(
    feature: dict,
    origin_xy: tuple[float, float],
    material,
):
    properties = feature["properties"]
    code = properties["code"]
    curve = bpy.data.curves.new(name=f"region_{code}_geometry", type="CURVE")
    curve.dimensions = "2D"
    curve.resolution_u = 1
    curve.resolution_v = 1
    curve.fill_mode = "BOTH"
    curve.extrude = 600.0
    curve.offset = 0.0

    for ring in geometry_rings(feature["geometry"]):
        coordinates = ring[:-1] if len(ring) > 2 and ring[0] == ring[-1] else ring
        if len(coordinates) < 3:
            continue
        spline = curve.splines.new(type="POLY")
        spline.points.add(len(coordinates) - 1)
        for point, coordinate in zip(spline.points, coordinates, strict=True):
            x, y = mercator_meters(float(coordinate[0]), float(coordinate[1]))
            point.co = (x - origin_xy[0], y - origin_xy[1], 0.0, 1.0)
        spline.use_cyclic_u = True

    item = bpy.data.objects.new(name=f"region_{code}", object_data=curve)
    bpy.context.scene.collection.objects.link(item)
    item.data.materials.append(material)
    item["region_code"] = code
    item["region_name"] = properties["name"]
    item["source_level"] = properties["level"]
    bpy.context.view_layer.objects.active = item
    item.select_set(True)
    bpy.ops.object.convert(target="MESH")
    item = bpy.context.view_layer.objects.active
    item.name = f"region_{code}"
    item.data.name = f"region_{code}_mesh"
    bevel = item.modifiers.new(name="Subtle edge bevel", type="BEVEL")
    bevel.width = 220.0
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    item.select_set(False)
    return item


def main() -> None:
    options = script_arguments()
    input_path = pathlib.Path(options.input).resolve()
    output_path = pathlib.Path(options.output).resolve()
    manifest_path = pathlib.Path(options.manifest).resolve()
    source = json.loads(input_path.read_text(encoding="utf-8"))
    features = source.get("features", [])
    by_code = {
        feature.get("properties", {}).get("code"): feature
        for feature in features
        if isinstance(feature, dict)
    }
    expected_codes = [code for code, _, _ in EXPECTED_REGIONS]
    if set(by_code) != set(expected_codes):
        raise ValueError(f"expected region codes={expected_codes}, received={sorted(by_code)}")

    geographic_points = list(all_coordinates(features))
    west = min(point[0] for point in geographic_points)
    south = min(point[1] for point in geographic_points)
    east = max(point[0] for point in geographic_points)
    north = max(point[1] for point in geographic_points)
    origin = ((west + east) / 2.0, (south + north) / 2.0)
    origin_xy = mercator_meters(*origin)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    generated_objects = []
    for code, expected_name, color in EXPECTED_REGIONS:
        feature = by_code[code]
        if feature.get("properties", {}).get("name") != expected_name:
            raise ValueError(f"unexpected name for {code}")
        material = make_material(f"region_{code}_material", color)
        generated_objects.append(make_region_object(feature, origin_xy, material))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for item in generated_objects:
        item.select_set(True)
    bpy.context.view_layer.objects.active = generated_objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_extras=True,
        export_yup=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )

    provenance = source.get("provenance", {})
    generated_at = provenance.get("refreshedAt") or datetime.now(timezone.utc).isoformat()
    manifest = {
        "asset": "/overview-monitoring/overview/blender/four-region-atlas.glb",
        "bounds": [west, south, east, north],
        "generatedAt": generated_at,
        "origin": list(origin),
        "projection": "EPSG:3857_LOCAL_METRES",
        "regions": [
            {"code": code, "name": name, "objectName": f"region_{code}"}
            for code, name, _ in EXPECTED_REGIONS
        ],
        "sourceName": provenance.get("sourceName", "overview regions API"),
        "sourceRevision": provenance.get("sourceRevision", "unavailable"),
        "version": 1,
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"BLENDER_ATLAS_OK regions={len(generated_objects)} "
        f"vertices={sum(len(item.data.vertices) for item in generated_objects)} "
        f"polygons={sum(len(item.data.polygons) for item in generated_objects)}"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
