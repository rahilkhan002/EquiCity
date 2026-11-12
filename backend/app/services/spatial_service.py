import math
from typing import List, Tuple, Optional
from shapely.geometry import shape, Point, Polygon
from shapely.ops import transform
import pyproj

WGS84 = pyproj.CRS("EPSG:4326")

def get_local_utm(lon: float, lat: float) -> pyproj.CRS:
    """Return the best UTM CRS for a given lon/lat."""
    zone = int((lon + 180) / 6) + 1
    hemi = "north" if lat >= 0 else "south"
    return pyproj.CRS(f"EPSG:{32600 + zone if hemi == 'north' else 32700 + zone}")

def project_to_meters(geojson_geom: dict, utm_crs: pyproj.CRS) -> any:
    """Project a GeoJSON geometry to a metric CRS using pyproj."""
    transformer = pyproj.Transformer.from_crs(WGS84, utm_crs, always_xy=True)
    geom = shape(geojson_geom)
    return transform(transformer.transform, geom)

def compute_min_distance_meters(tract_geom: dict, project_geom: dict) -> float:
    """Minimum planar distance in meters between tract and project geometries."""
    tract_shape = shape(tract_geom)
    centroid = tract_shape.centroid
    utm = get_local_utm(centroid.x, centroid.y)
    tract_m = project_to_meters(tract_geom, utm)
    proj_m = project_to_meters(project_geom, utm)
    dist = tract_m.distance(proj_m)
    return max(0.0, dist)

def buffer_polygon_meters(geojson_geom: dict, buffer_m: float) -> dict:
    """Buffer a GeoJSON polygon by buffer_m meters. Returns GeoJSON dict."""
    geom = shape(geojson_geom)
    centroid = geom.centroid
    utm = get_local_utm(centroid.x, centroid.y)
    geom_m = project_to_meters(geojson_geom, utm)
    buffered_m = geom_m.buffer(buffer_m)
    # Back-project to WGS84
    transformer_back = pyproj.Transformer.from_crs(utm, WGS84, always_xy=True)
    buffered_wgs = transform(transformer_back.transform, buffered_m)
    return {
        "type": "Polygon",
        "coordinates": [list(map(list, buffered_wgs.exterior.coords))]
    }

def geojson_contains(container_geojson: dict, point_lon: float, point_lat: float) -> bool:
    poly = shape(container_geojson)
    pt = Point(point_lon, point_lat)
    return poly.contains(pt)

def polygon_intersects(geom_a: dict, geom_b: dict) -> bool:
    return shape(geom_a).intersects(shape(geom_b))
