import express from "express";
// @ts-ignore
import geoblaze from "geoblaze";
import area from "@turf/area";
import axios from "axios";
import { createGeoJSONCircle } from "./helpers";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));

let pop5MapGeoRaster: any;
let pop4MapGeoRaster: any;
let pop3MapGeoRaster: any;
let pop2MapGeoRaster: any;
let pop1MapGeoRaster: any;

app.post("/pop", async (req, res) => {
  console.log("-----------------------------------");
  const body = req.body;
  const defaultPoints = 64;

  const {
    center,
    radii,
  }: {
    center: number[];
    radii: number[];
  } = body;

  // Check for missing data
  if (!center || !radii) {
    res.status(400).json({
      error: "Missing center or radii",
    });
    res.end();
    return;
  }

  // Create the blast areas
  let _blastAreas = [];
  for (let i = 0; i < radii.length; i++) {
    const radius = radii[i];

    const _blastGeoJson = createGeoJSONCircle({
      center: center,
      outerRadiusInKm: radius,
      points: defaultPoints,
    });
    _blastAreas.push(_blastGeoJson);
  }

  // Loop through the blast areas and calculate the population
  let _populationResults: any = [];

  for (let i = 0; i < _blastAreas.length; i++) {
    const _blastArea: any = _blastAreas[i];

    // @ts-ignore
    let _blastAreaKm = area(_blastArea) / 1000000;

    // Determine the map type to use
    let populationMapType = "pop5";
    let popGeoRaster = pop5MapGeoRaster;

    if (_blastAreaKm > 550) {
      populationMapType = "pop4";
      popGeoRaster = pop4MapGeoRaster;
    }
    if (_blastAreaKm > 1500) {
      populationMapType = "pop3";
      popGeoRaster = pop3MapGeoRaster;
    }
    if (_blastAreaKm > 15000) {
      populationMapType = "pop2";
      popGeoRaster = pop2MapGeoRaster;
    }
    if (_blastAreaKm > 100000) {
      populationMapType = "pop1";
      popGeoRaster = pop1MapGeoRaster;
    }

    let populationResult;
    try {
      populationResult = await geoblaze.sum(popGeoRaster, _blastArea);
    } catch {
      populationResult = 0;
    }

    _populationResults.push({
      population: parseInt(populationResult),
      radiusKm: radii[i],
      areaKm: Math.round(_blastAreaKm),
      mapType: populationMapType,
    });
  }

  for (let i = 0; i < _populationResults.length; i++) {
    const _populationResult = _populationResults[i];
    const _previousPopulationResult = _populationResults[i - 1];

    if (_previousPopulationResult) {
      _populationResult.populationOriginal = _populationResult.population;
      _populationResult.population =
        _populationResult.population - _previousPopulationResult.population;

      _populationResult.areaKm =
        _populationResult.areaKm - _previousPopulationResult.areaKm;
    }
  }

  res.status(200).json({
    population: _populationResults,
  });
});

app.post("/geo", async (req, res) => {
  console.log("----------------  ADDRESS FIND --------------------");
  const body = req.body;

  const {
    coordinates,
    address,
  }: {
    coordinates?: number[];
    address?: string;
  } = body;

  // Check for missing data
  if (!coordinates && !address) {
    res.status(400).json({
      error: "Missing coordinates or address",
    });
    res.end();
    return;
  }
  let addressSearchData;
  if (coordinates) {
    addressSearchData = await axios({
      method: "get",
      url: `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates[0]},${coordinates[1]}.json?limit=1&access_token=pk.eyJ1IjoiemFjaGFyeWJlZHJvc2lhbiIsImEiOiJja2V2dTh4NWwwMHloMzBqcmdyNmppZjRqIn0.pssVFWlGhGl4sqZ--d2hLA`,
    })
      .then(({ data }) => {
        return data;
      })
      .catch((error) => {
        return null;
      });
  } else {
    addressSearchData = await axios({
      method: "get",
      url: `https://api.mapbox.com/geocoding/v5/mapbox.places/${address}.json?limit=9&autocomplete=true&fuzzyMatch=true&access_token=pk.eyJ1IjoiemFjaGFyeWJlZHJvc2lhbiIsImEiOiJja2V2dTh4NWwwMHloMzBqcmdyNmppZjRqIn0.pssVFWlGhGl4sqZ--d2hLA`,
    })
      .then(({ data }) => {
        return data;
      })
      .catch((error) => {
        return null;
      });
  }

  res.status(200).json({
    addressSearchData,
  });
});

app.listen(Number(port), "0.0.0.0", async () => {
  pop5MapGeoRaster = await geoblaze.parse(
    `https://cleancult-production-static.s3.amazonaws.com/gpw_v4_population_count_rev11_2000_30_sec.tif`
  );
  console.log("Loaded Pop 5 Map");

  pop4MapGeoRaster = await geoblaze.load(
    `https://map-gules.vercel.app/maps/pop4.tif`
  );
  console.log("Loaded Pop 4 Map");

  pop3MapGeoRaster = await geoblaze.load(
    `https://map-gules.vercel.app/maps/pop3.tif`
  );
  console.log("Loaded Pop 3 Map");

  pop2MapGeoRaster = await geoblaze.load(
    `https://map-gules.vercel.app/maps/pop2.tif`
  );
  console.log("Loaded Pop 2 Map");

  pop1MapGeoRaster = await geoblaze.parse(
    `https://map-gules.vercel.app/maps/pop1.tif`
  );
  console.log("Loaded Pop 1 Map");

  console.log(`Example app listening at http://localhost:${port}`);
});
