// Manifesto de assets: fonte única para o carregador do cliente e para os prompts de geração.
// O jogo roda sem nenhum arquivo: cada asset ausente vira um marcador desenhado por código.
// Para usar a sua arte, salve o PNG em client/public/assets/<path>.

export type AssetFormat = 'sheet' | 'image' | 'tile' | 'props' | 'fx' | 'icon' | 'wide'
export interface AssetDef {
  id: string
  path: string // relativo a client/public/assets/
  format: AssetFormat
  category: string
  title: string // nome em português
  subject: string // descrição visual em inglês, usada no prompt
  optional?: boolean // sem o arquivo, o jogo usa outro asset (fallback) redimensionado
}
/** Grade de cada formato: colunas × linhas. O cliente divide a imagem por esses números, em qualquer resolução. */
export const FORMAT_GRID: Record<AssetFormat, { cols: number; rows: number }> = {
  sheet: { cols: 4, rows: 4 }, image: { cols: 1, rows: 1 }, tile: { cols: 1, rows: 1 }, props: { cols: 2, rows: 2 },
  fx: { cols: 2, rows: 2 }, icon: { cols: 1, rows: 1 }, wide: { cols: 1, rows: 1 },
}

const list: AssetDef[] = []
const add = (category: string, format: AssetFormat, dir: string, rows: [id: string, title: string, subject: string, optional?: boolean][]) => {
  for (const [id, title, subject, optional] of rows) list.push({ id: `${dir}/${id}`, path: `${dir}/${id}.png`, format, category, title, subject, ...(optional ? { optional } : {}) })
}

add('Caçadores (classes)', 'sheet', 'cacadores', [
  ['lamina', 'Caçador Lâmina', 'a sturdy hunter in a dark charcoal combat coat with steel shoulder guard, carrying a broad one-handed sword, short dark hair, violet glowing trim on the coat'],
  ['vulto', 'Caçador Vulto', 'a lean agile hunter in a black hooded jacket and face scarf, holding two short daggers in reverse grip, teal glowing trim'],
  ['arcanista', 'Caçador Arcanista', 'a slim hunter in a long dark indigo coat with a high collar, holding a short metal staff tipped with a floating violet crystal, silver hair'],
  ['atirador', 'Caçador Atirador', 'a hunter in a dark green tactical cloak with a quiver on the back, holding a compact recurve bow, amber glowing trim'],
])
add('NPCs da cidade', 'image', 'npcs', [
  ['guardia-das-fendas', 'Ísis, Guardiã das Fendas', 'a calm woman in a long white-and-violet officer coat holding a glowing tablet, facing the viewer'],
  ['mercador', 'Tobias, o Mercador', 'a cheerful stocky merchant with a big backpack full of bottles and pouches, brown apron, facing the viewer'],
  ['ferreira', 'Dária, a Ferreira', 'a muscular blacksmith woman with a leather apron, soot on her arms, holding a hammer on her shoulder, facing the viewer'],
  ['arquivista', 'Noé, o Arquivista', 'a thin elderly archivist with round glasses, grey robe, carrying a large book and a quill, facing the viewer'],
])
add('Monstros comuns', 'sheet', 'monstros', [
  ['larva-de-ferrugem', 'Larva de Ferrugem', 'a fat segmented grub the size of a dog with rust-orange metal plates on its back and small mandibles'],
  ['morcego-de-cinza', 'Morcego de Cinza', 'a large grey bat with tattered wings that shed ash particles, glowing ember-orange eyes'],
  ['catador-oco', 'Catador Oco', 'a hunched hollow-eyed humanoid scavenger made of dark rags and mining scrap, carrying a rusty pickaxe, an empty glowing-blue chest cavity'],
  ['lobo-de-nevoa', 'Lobo de Névoa', 'a grey wolf whose legs and tail dissolve into pale mist, pale blue eyes'],
  ['espinheiro-vivo', 'Espinheiro Vivo', 'a walking bramble bush creature with thorny vine arms and a single pale-green glowing bud for a head'],
  ['cervo-espectral', 'Cervo Espectral', 'a translucent ghostly stag with bone-white antlers and a faint cyan glow inside its chest'],
  ['sentinela-afogada', 'Sentinela Afogada', 'a waterlogged armored soldier covered in barnacles and seaweed, holding a corroded spear, dripping water'],
  ['sacerdote-do-lodo', 'Sacerdote do Lodo', 'a robed cultist whose robe melts into dark green mud, holding a lantern with a sickly green flame'],
  ['armadura-vazia', 'Armadura Vazia', 'an empty animated suit of dark plate armor with violet light leaking from the joints, holding a greatsword'],
  ['brasa-errante', 'Brasa Errante', 'a floating cluster of glowing coals bound by black iron rings, small flames trailing behind'],
  ['golem-de-escoria', 'Golem de Escória', 'a bulky golem made of cooled black slag with cracks of molten orange, heavy fists'],
  ['serpe-de-cinza', 'Serpe de Cinza', 'a small wingless ash-grey wyvern-like lizard walking on four legs with smoking nostrils and charcoal scales'],
])
add('Chefes (opcionais)', 'sheet', 'monstros', [
  ['larva-mae', 'Larva-Mãe', 'a huge bloated grub queen with thick rust-orange armor plates, many small legs and a crown of jagged metal spikes', true],
  ['asa-ancia', 'Asa Anciã', 'a giant ancient bat with scarred torn wings, a mane of white fur and burning orange eyes, ash falling from its wings', true],
  ['capataz-oco', 'Capataz Oco', 'a tall hollow humanoid foreman in a tattered long coat and a cracked mining helmet with a lamp, wielding a heavy chain, glowing blue chest cavity', true],
  ['alfa-da-nevoa', 'Alfa da Névoa', 'a massive white-grey alpha wolf with a mist mane and three glowing pale-blue eyes', true],
  ['raiz-ancia', 'Raiz Anciã', 'a towering old tree-root creature with thorn whips, moss beard and several pale-green glowing buds', true],
  ['rei-galhado', 'Rei Galhado', 'a regal ghostly stag king with enormous branching antlers wrapped in cyan spirit flames', true],
  ['capitao-das-mares', 'Capitão das Marés', 'a drowned captain in a barnacle-covered coat and tricorn-like helmet, wielding a rusted anchor as a weapon', true],
  ['hierofante-do-lodo', 'Hierofante do Lodo', 'a tall high priest with a tall mud-dripping mitre, carrying a censer that spills green fog, robe melting into sludge', true],
  ['guardiao-do-selo', 'Guardião do Selo', 'a colossal empty armor with a tower shield engraved with a glowing violet seal and a halberd', true],
  ['coracao-de-fornalha', 'Coração de Fornalha', 'a huge floating furnace core of white-hot coals inside a cracked iron cage, flames bursting from the gaps', true],
  ['colosso-de-escoria', 'Colosso de Escória', 'a giant slag colossus with molten orange veins, one arm shaped like a hammer', true],
  ['serpe-matriarca', 'Serpe Matriarca', 'a large ash-grey wyvern matriarch with small folded wings, horned crest and glowing ember throat', true],
])
add('Mapas: chão (textura contínua)', 'tile', 'mapas', [
  ['cidade-chao', `Chão da cidade`, 'dark slate stone pavement of a modern city plaza at night, subtle violet reflections, occasional cracks'],
  ['minas-ocas-chao', 'Chão das Minas Ocas', 'dark brown cave floor with gravel, rust stains and faint rail tracks marks'],
  ['bosque-cinzento-chao', 'Chão do Bosque Cinzento', 'grey-green forest floor with dead leaves, moss patches and thin mist'],
  ['cidadela-afundada-chao', 'Chão da Cidadela Afundada', 'wet cracked dark-teal stone tiles with shallow puddles and seaweed'],
  ['forja-extinta-chao', 'Chão da Forja Extinta', 'black basalt foundry floor with soot, metal grates and thin glowing orange cracks'],
  ['arena-chao', 'Chão da arena de promoção', 'clean dark grey training arena floor with faint white painted lines and violet edge lights'],
])
add('Mapas: objetos de cenário', 'props', 'mapas', [
  ['cidade-objetos', 'Objetos da cidade', 'four separate props, one per cell: a street lamp with violet light, a stone bench, a notice board, a potted dark shrub'],
  ['minas-ocas-objetos', 'Objetos das Minas Ocas', 'four separate props, one per cell: a broken mine cart, a wooden support beam, a pile of ore rocks, a hanging oil lantern on a post'],
  ['bosque-cinzento-objetos', 'Objetos do Bosque Cinzento', 'four separate props, one per cell: a dead grey tree, a mossy boulder, a thorn bush, a fallen log'],
  ['cidadela-afundada-objetos', 'Objetos da Cidadela Afundada', 'four separate props, one per cell: a broken stone pillar, a barnacle-covered statue, a rusted iron gate fragment, a coral cluster'],
  ['forja-extinta-objetos', 'Objetos da Forja Extinta', 'four separate props, one per cell: an anvil, a cracked crucible with a faint glow, a pile of slag, a broken iron chain pile'],
])
add('Objetos do mundo', 'image', 'objetos', [
  ['fenda', 'Fenda (portal)', 'a vertical oval tear in space, a swirling violet-and-cyan vortex with a bright rim and small floating shards around it'],
  ['resquicio', 'Resquício (corpo para evocar)', 'a small pile of dark smoky remains on the ground with a faint violet wisp rising from it'],
])
add('Efeitos', 'fx', 'efeitos', [
  ['golpe', 'Golpe corpo a corpo', 'a white-violet crescent slash arc, four animation frames in reading order: thin start, full arc, fading arc, small sparks'],
  ['evocacao', 'Evocação de eco', 'a dark violet shadow rising from the ground as a pillar of smoke with cyan sparks, four animation frames in reading order: ground circle, rising, peak, dissipating'],
  ['subir-nivel', 'Subir de nível', 'a golden-white ring of light bursting upward with small stars, four animation frames in reading order: small ring, expanding, peak with rays, fading'],
])
add('Efeitos', 'image', 'efeitos', [
  ['projetil-arcano', 'Projétil arcano', 'a small glowing violet energy orb with a short trail, pointing to the right'],
  ['flecha', 'Flecha', 'a single arrow with an amber glowing tip, pointing to the right, horizontal'],
])
add('Ícones de itens', 'icon', 'icones/itens', [
  ['arma-lamina', 'Espada (Lâmina)', 'a broad one-handed sword with a dark hilt'],
  ['arma-vulto', 'Adagas (Vulto)', 'two crossed short daggers'],
  ['arma-arcanista', 'Cajado (Arcanista)', 'a short metal staff with a violet crystal tip'],
  ['arma-atirador', 'Arco (Atirador)', 'a compact recurve bow with one arrow'],
  ['elmo', 'Elmo', 'a dark steel combat helmet with a visor'],
  ['armadura', 'Armadura', 'a dark armored chest piece'],
  ['luvas', 'Luvas', 'a pair of armored gauntlets'],
  ['botas', 'Botas', 'a pair of reinforced combat boots'],
  ['anel', 'Anel', 'a silver ring with a small glowing gem'],
  ['pocao', 'Poção de Vida', 'a round glass flask with red liquid and a cork'],
  ['fragmento', 'Fragmento de Eco', 'a jagged dark crystal shard with a violet glow inside'],
  ['lasca', 'Lasca de Fenda', 'a thin cyan crystalline splinter emitting sparks'],
  ['ouro', 'Ouro', 'a small stack of gold coins'],
])
add('Ícones de atributos', 'icon', 'icones/atributos', [
  ['for', 'Força', 'a clenched fist, red accent'],
  ['agi', 'Agilidade', 'a winged boot, green accent'],
  ['vit', 'Vitalidade', 'a heart with a shield outline, pink accent'],
  ['int', 'Intelecto', 'an open book with a spark above it, blue accent'],
  ['per', 'Percepção', 'a stylized eye with a crosshair, yellow accent'],
])
add('Emblemas de classe', 'icon', 'icones/classes', [
  ['lamina', 'Emblema Lâmina', 'a shield emblem with a vertical sword, violet accent'],
  ['vulto', 'Emblema Vulto', 'a hood silhouette with two crossed daggers, teal accent'],
  ['arcanista', 'Emblema Arcanista', 'a crystal inside a circle of runes, indigo accent'],
  ['atirador', 'Emblema Atirador', 'a bow with a nocked arrow inside a circle, amber accent'],
])
add('Ícones do menu', 'icon', 'icones/menu', [
  ['status', 'Status', 'a character silhouette bust with a small plus sign'],
  ['mochila', 'Mochila', 'a leather backpack'],
  ['ecos', 'Ecos', 'three overlapping shadowy figures with glowing eyes'],
  ['fendas', 'Fendas', 'a swirling portal tear'],
])
add('Interface', 'wide', 'ui', [
  ['logo', 'Logotipo do jogo', 'a game logo emblem without any letters: a violet portal tear behind a hooded hunter silhouette, framed by angular metallic borders, transparent background'],
  ['fundo-login', 'Fundo da tela de entrada', 'a wide night scene: a lone hooded hunter seen from behind standing before a huge glowing violet rift in the middle of a dark city plaza, shadows of creatures rising from the ground around, opaque full background'],
])
add('Interface', 'icon', 'ui', [
  ['favicon', 'Favicon', 'a minimal violet portal tear symbol, very simple, readable at 32 pixels'],
])

export const ASSETS: AssetDef[] = list
export const ASSET_BY_ID: Record<string, AssetDef> = Object.fromEntries(list.map((a) => [a.id, a]))
