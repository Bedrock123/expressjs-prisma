const _generatePolygonCoordinates = ({
  center,
  radiusInKm,
  points,
}: {
  center: number[];
  radiusInKm: number;
  points: number;
}) => {
  const coords = {
    latitude: center[1],
    longitude: center[0],
  };

  const ret = [];
  const distanceX =
    radiusInKm / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  const distanceY = radiusInKm / 110.574;

  let theta, x, y;
  for (let i = 0; i < points; i++) {
    theta = (i / points) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);

    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);

  return ret;
};

export const createGeoJSONCircle = ({
  center,
  outerRadiusInKm,
  points,
}: {
  center: number[];
  outerRadiusInKm: number;
  points: number;
}) => {
  if (!points) points = 64;

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            _generatePolygonCoordinates({
              center,
              radiusInKm: outerRadiusInKm,
              points,
            }),
          ],
        },
      },
    ],
  };
};

export const createGeoJSONDonut = ({
  center,
  outerRadiusInKm,
  innerRadiusInKm,
  points,
}: {
  center: number[];
  outerRadiusInKm: number;
  innerRadiusInKm: number;
  points: number;
}) => {
  if (!points) points = 64;

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            _generatePolygonCoordinates({
              center,
              radiusInKm: outerRadiusInKm,
              points,
            }),
            _generatePolygonCoordinates({
              center,
              radiusInKm: innerRadiusInKm,
              points,
            }),
          ],
        },
      },
    ],
  };
};
