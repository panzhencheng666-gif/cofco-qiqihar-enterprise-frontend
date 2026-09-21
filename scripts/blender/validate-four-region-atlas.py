import argparse
import json
import pathlib
import sys
import traceback

import bpy


EXPECTED_REGIONS = {
    "150700": "呼伦贝尔市",
    "230200": "齐齐哈尔市",
    "231100": "黑河市",
    "232700": "大兴安岭地区",
}


def script_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", required=True)
    parser.add_argument("--manifest", required=True)
    return parser.parse_args(arguments)


def fail(message: str) -> None:
    raise RuntimeError(f"BLENDER_ATLAS_INVALID {message}")


def main() -> None:
    options = script_arguments()
    asset_path = pathlib.Path(options.asset).resolve()
    manifest_path = pathlib.Path(options.manifest).resolve()
    if not asset_path.is_file():
        fail(f"missing asset={asset_path}")
    if not manifest_path.is_file():
        fail(f"missing manifest={manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("version") != 1:
        fail("manifest version must be 1")
    if manifest.get("projection") != "EPSG:3857_LOCAL_METRES":
        fail("projection must be EPSG:3857_LOCAL_METRES")
    manifest_regions = {
        item.get("code"): item
        for item in manifest.get("regions", [])
        if isinstance(item, dict)
    }
    if set(manifest_regions) != set(EXPECTED_REGIONS):
        fail(f"manifest regions={sorted(manifest_regions)}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(asset_path))
    meshes = {item.name: item for item in bpy.data.objects if item.type == "MESH"}
    for code, name in EXPECTED_REGIONS.items():
        object_name = f"region_{code}"
        item = meshes.get(object_name)
        if item is None:
            fail(f"missing object={object_name}")
        if len(item.data.polygons) == 0:
            fail(f"empty object={object_name}")
        if item.get("region_code") != code or item.get("region_name") != name:
            fail(f"metadata mismatch object={object_name}")
        if manifest_regions[code].get("objectName") != object_name:
            fail(f"manifest object mismatch code={code}")

    print(f"BLENDER_ATLAS_VALID objects={len(EXPECTED_REGIONS)}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
