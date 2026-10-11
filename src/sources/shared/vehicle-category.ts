import type { ListingCategory } from "@/domain/listings/types";

/** Marcas só de motos (e ciclomotores) vistas nas fontes e no mercado. */
const MOTO_BRANDS = new Set([
  "YAMAHA",
  "DAFRA",
  "SHINERAY",
  "SUNDOWN",
  "KASINSKI",
  "TRAXX",
  "HAOJUE",
  "JTZ",
  "IROS",
  "FASPIDER",
  "GARINNI",
  "WUYANG",
  "BRAVAX",
  "CHARMING",
  "KAWASAKI",
  "HARLEY-DAVIDSON",
  "TRIUMPH",
  "DUCATI",
  "KTM",
  "MOTTU",
  "AVELLOZ",
  "CICLOMOTOR",
  "MVK",
  "AMAZONAS",
  "HYOSUNG",
]);
const CAR_BRANDS = new Set([
  "VW",
  "VOLKSWAGEN",
  "GM",
  "CHEVROLET",
  "FIAT",
  "FORD",
  "RENAULT",
  "PEUGEOT",
  "CITROEN",
  "TOYOTA",
  "HYUNDAI",
  "KIA",
  "NISSAN",
  "MITSUBISHI",
  "JEEP",
  "CHERY",
  "JAC",
  "LR",
  "LAND ROVER",
  "AUDI",
  "SSANGYONG",
  "SUBARU",
  "DODGE",
  "BYD",
  "GWM",
  "MINI",
  "TROLLER",
  "MERCEDES-BENZ",
  "BMW",
  "HAFEI",
]);
/** Modelos de carro das marcas que vendem mais motos (Honda, Suzuki). */
const HONDA_CARS = /^(CIVIC|CITY|FIT|HR-?V|WR-?V|CR-?V|ACCORD|ODYSSEY|ZR-?V)\b/;
const SUZUKI_CARS = /^(VITARA|GRAND|JIMNY|SWIFT|SX4|S-CROSS|BALENO|IGNIS|SAMURAI)\b/;
const BMW_MOTOS = /^[GFRSK] ?\d{3,4}\b/;
const UTILITY_MODELS =
  /^(KOMBI|SAVEIRO|STRADA|MONTANA|S10|HILUX|RANGER|FIORINO|DOBLO|TORO|AMAROK|FRONTIER|L200|D ?10|D ?20|F ?1000|F ?250|COURIER|PAMPA|SPRINTER|MASTER|DUCATO|TRAFIC|EXPERT|JUMPER|BOXER|HR|BONGO|OROCH|TOWNER|RUIYI|MAVERICK|SILVERADO|C ?10|C ?20|A ?10|A ?20)\b/;
/** Caminhões e ônibus das marcas de carro: "CARGO", "F 4000", "D 60", "8.150", "L 1113", "ATEGO", "12000". */
const HEAVY_MODELS =
  /^(CARGO|F ?[4-9]000|F ?1[1-4]000|D ?[4-9]0|\d{1,2}\.\d{3}|\d{4,5}|L ?\d{4}|LS ?\d{4}|LO|OF|ATEGO|ACCELO|AXOR|ACTROS)\b/;

/**
 * Categoria pela marca e modelo, para fonte que não diz o tipo (Detran-MG) ou o diz errado (moto do Superbid em
 * "Carros > Hatches"). Na dúvida fica `null`, nunca adivinhada (reboques, artesanais, marcas desconhecidas).
 */
export function categoryOfVehicle(brand: string | null, model: string | null): ListingCategory | null {
  if (brand === null) return null;
  const name = model ?? "";
  if (brand === "SCANIA" || brand === "IVECO") return "Pesados";
  if (MOTO_BRANDS.has(brand)) return "Motos";
  if (brand === "HONDA") return HONDA_CARS.test(name) ? "Carros" : "Motos";
  if (brand === "SUZUKI") return SUZUKI_CARS.test(name) ? "Carros" : "Motos";
  if (brand === "BMW" && BMW_MOTOS.test(name)) return "Motos";
  if (!CAR_BRANDS.has(brand)) return null;
  if (HEAVY_MODELS.test(name)) return "Pesados";
  return UTILITY_MODELS.test(name) ? "Utilitarios" : "Carros";
}

/** Marca conhecida de veículo, para reconhecer a ordem "MODELO - MARCA" de alguns títulos ("KOMBI - VW"). */
export function isKnownVehicleBrand(word: string): boolean {
  return MOTO_BRANDS.has(word) || CAR_BRANDS.has(word) || ["HONDA", "SUZUKI", "SCANIA", "IVECO"].includes(word);
}
