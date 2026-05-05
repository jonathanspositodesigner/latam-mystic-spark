export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const SYNONYM_GROUPS: string[][] = [
  ["hombre", "muchacho", "chico", "masculino", "tipo", "señor", "macho"],
  ["mujer", "muchacha", "chica", "femenino", "señora", "dama"],
  ["pareja", "couple", "dupla", "par", "novios", "juntos"],
  ["niño", "niña", "kid", "infantil", "bebé", "baby", "nené", "child"],
  ["anciano", "viejo", "tercera edad", "elderly"],
  ["fiesta", "baile", "party", "evento", "celebración", "conmemoración", "night", "noche"],
  ["casamiento", "boda", "novia", "novio", "wedding", "matrimonio"],
  ["cumpleaños", "birthday", "parabienes"],
  ["graduación", "graduation", "diploma"],
  ["barbacoa", "bbq", "asado", "parrillada"],
  ["navidad", "christmas", "xmas"],
  ["halloween", "noche de brujas"],
  ["carnaval", "carnival"],
  ["show", "concierto", "espectáculo", "presentación", "live", "gig"],
  ["ropa", "vestimenta", "traje", "outfit", "look", "vestuario"],
  ["traje", "suit", "blazer", "saco"],
  ["vestido", "dress"],
  ["camiseta", "camisa", "t-shirt", "remera", "blusa", "top"],
  ["pantalones", "pants", "jeans", "bermuda", "shorts"],
  ["falda", "skirt", "pollera"],
  ["zapato", "shoe", "tenis", "sneaker", "bota", "sandalia"],
  ["gorra", "cap", "sombrero", "hat", "gorro"],
  ["lentes", "anteojos", "gafas", "sunglasses", "gafas de sol"],
  ["reloj", "watch"],
  ["chaqueta", "jacket", "campera", "abrigo", "buzo", "hoodie"],
  ["bikini", "bañador", "malla", "beachwear"],
  ["lencería", "underwear", "ropa interior"],
  ["elegante", "sofisticado", "chique", "lujoso", "classy", "fino"],
  ["casual", "informal", "relajado"],
  ["sexy", "sensual", "seductor", "hot"],
  ["deportivo", "sport", "atlético", "fitness", "gym", "academia"],
  ["vintage", "retrô", "retro", "antiguo", "old school"],
  ["moderno", "modern", "contemporáneo", "actual", "trendy"],
  ["streetwear", "urban", "urbano", "street"],
  ["negro", "black", "oscuro"],
  ["blanco", "white", "claro"],
  ["rojo", "red"],
  ["azul", "blue"],
  ["verde", "green"],
  ["amarillo", "yellow", "dorado", "gold", "oro"],
  ["rosa", "pink"],
  ["morado", "purple", "violeta", "lila"],
  ["naranja", "orange"],
  ["gris", "gray", "grey", "plata", "silver"],
  ["marrón", "brown", "café"],
  ["playa", "beach", "mar", "océano", "costa"],
  ["ciudad", "city", "urbano", "metrópolis"],
  ["campo", "rural", "granja", "naturaleza", "nature"],
  ["montaña", "mountain", "sierra", "cerro"],
  ["bosque", "forest", "selva", "jungle"],
  ["estudio", "studio", "backdrop"],
  ["calle", "street", "avenida"],
  ["bar", "pub", "boite", "nightclub", "discoteca", "club"],
  ["restaurante", "restaurant", "café", "cafetería"],
  ["iglesia", "templo", "capilla"],
  ["piscina", "pool", "alberca"],
  ["sentado", "sitting"],
  ["de pie", "standing"],
  ["acostado", "lying"],
  ["caminando", "walking"],
  ["corriendo", "running"],
  ["bailando", "dancing"],
  ["sonriendo", "smiling", "feliz", "happy"],
  ["nocturno", "night", "noche", "oscuro"],
  ["diurno", "day", "día", "daylight"],
  ["atardecer", "sunset", "pôr do sol", "golden hour"],
  ["cantante", "singer", "vocalista"],
  ["rapper", "rap", "mc", "hip hop"],
  ["dj", "disc jockey", "productor", "producer"],
  ["guitarrista", "guitar", "guitarra"],
  ["carro", "car", "automóvil", "vehículo", "auto", "coche"],
  ["moto", "motorcycle", "motocicleta", "bike"],
  ["celular", "phone", "smartphone", "teléfono"],
  ["lujo", "luxury", "rico", "glamour", "premium"],
  ["simple", "minimalista", "clean", "básico"],
  ["artístico", "art", "arte", "creative"],
  ["profesional", "professional", "corporativo", "business"],
  ["flyer", "folleto", "panfleto", "cartel", "banner", "poster"],
  ["invitación", "invitation", "invite"],
  ["promoción", "promo", "oferta", "descuento", "sale"],
];

const synonymMap = new Map<string, Set<string>>();

for (const group of SYNONYM_GROUPS) {
  const normalizedGroup = group.map(w => w.toLowerCase().trim());
  const groupSet = new Set(normalizedGroup);
  for (const w of normalizedGroup) {
    const stripped = removeAccents(w);
    if (stripped !== w) groupSet.add(stripped);
  }
  for (const word of Array.from(groupSet)) {
    const variants = [word, removeAccents(word)];
    for (const variant of variants) {
      if (synonymMap.has(variant)) {
        const existing = synonymMap.get(variant)!;
        for (const w of groupSet) existing.add(w);
        for (const w of existing) synonymMap.set(w, existing);
      } else {
        synonymMap.set(variant, groupSet);
      }
    }
  }
}

export function getSynonyms(word: string): string[] {
  const normalized = word.toLowerCase().trim();
  if (!normalized) return [];
  const group = synonymMap.get(normalized) || synonymMap.get(removeAccents(normalized));
  return group ? Array.from(group) : [normalized];
}

export function expandSearchTerms(search: string): string[] {
  const words = search.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return [];
  const allTerms = new Set<string>();
  for (const word of words) {
    allTerms.add(word);
    allTerms.add(removeAccents(word));
    for (const synonym of getSynonyms(word)) {
      allTerms.add(synonym);
      allTerms.add(removeAccents(synonym));
    }
  }
  return Array.from(allTerms);
}