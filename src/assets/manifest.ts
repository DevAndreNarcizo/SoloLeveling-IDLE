/**
 * Manifesto de assets: fonte única de verdade para tudo que é visual.
 *
 * Cada entrada define identidade, destino em disco, dimensões finais e o
 * "subject" usado para compor o prompt de geração. A partir daqui são
 * derivados:
 *  - docs/ASSET_PROMPTS.md (npm run assets:prompts);
 *  - a validação dos arquivos entregues (npm run assets:check);
 *  - a resolução de sprites em runtime, com placeholder quando ausentes.
 *
 * Este módulo é puro (sem APIs de browser/Vite) para poder ser consumido
 * pelos scripts de Node e pelos testes.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type AssetCategory = 'hunter' | 'monster' | 'boss' | 'item' | 'icon' | 'background' | 'ui';

export interface AssetSpec {
  id: string;
  category: AssetCategory;
  /** Nome exibido na documentação (pt-BR). */
  title: string;
  /** Descrição do conteúdo em inglês: geradores de imagem respondem melhor. */
  subject: string;
  /** Caminho final relativo a `src/assets/sprites`. */
  file: string;
  width: number;
  height: number;
  transparent: boolean;
  /** Cor sólida de fundo quando a ferramenta não gera transparência. */
  chroma: string;
}

interface CategoryRule {
  folder: string;
  width: number;
  height: number;
  transparent: boolean;
  /** Resolução/proporção recomendada na geração, antes do pós-processamento. */
  generation: string;
  /** Enquadramento e composição, comum a toda a categoria. */
  framing: string;
}

export const CATEGORY_RULES: Readonly<Record<AssetCategory, CategoryRule>> = {
  hunter: {
    folder: 'hunters',
    width: 256,
    height: 256,
    transparent: true,
    generation: '1024x1024 (1:1)',
    framing:
      'Full-body game character sprite, strict side view, character facing RIGHT, standing in a ready combat idle pose. The entire figure is visible from head to feet, centered horizontally, occupying about 80% of the canvas height, feet resting near the bottom edge with a small margin. Exactly one character.',
  },
  monster: {
    folder: 'monsters',
    width: 256,
    height: 256,
    transparent: true,
    generation: '1024x1024 (1:1)',
    framing:
      'Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.',
  },
  boss: {
    folder: 'monsters',
    width: 384,
    height: 384,
    transparent: true,
    generation: '1024x1024 (1:1)',
    framing:
      'Full-body game boss sprite, strict side view, creature facing LEFT, in an imposing, threatening idle pose. The entire creature is visible, centered horizontally, occupying about 90% of the canvas, resting near the bottom edge with a small margin. Exactly one creature, clearly larger and more elaborate than a regular enemy.',
  },
  item: {
    folder: 'items',
    width: 128,
    height: 128,
    transparent: true,
    generation: '1024x1024 (1:1)',
    framing:
      'Single game inventory icon of one object, centered, shown at a slight three-quarter angle, occupying about 75% of the canvas. No frame, no border, no slot background, no hands holding it.',
  },
  icon: {
    folder: 'icons',
    width: 128,
    height: 128,
    transparent: true,
    generation: '1024x1024 (1:1)',
    framing:
      'Single game UI icon of one simple symbol, centered, front view, occupying about 70% of the canvas, bold and readable silhouette that stays clear at 24 pixels. No frame, no border, no badge background.',
  },
  background: {
    folder: 'backgrounds',
    width: 1280,
    height: 720,
    transparent: false,
    generation: '1920x1080 ou a proporção 16:9 mais próxima disponível',
    framing:
      'Wide 2D side-view game battle background, 16:9, eye-level camera. A clear, mostly flat ground strip runs across the lower third of the image where characters will stand. Two or three depth layers fading into atmospheric haze. Slightly darker and less saturated than foreground sprites so characters stand out. Absolutely no characters, no creatures, no people.',
  },
  ui: {
    folder: 'ui',
    width: 512,
    height: 512,
    transparent: true,
    generation: '1024x1024 (1:1)',
    framing:
      'Single game emblem, centered, front view, symmetrical, occupying about 80% of the canvas. No lettering of any kind.',
  },
};

/** Direção de arte compartilhada por todos os assets (consistência visual). */
export const STYLE_BIBLE =
  'Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.';

export const AVOID_LINE =
  'Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.';

const GREEN = '#00FF00';
/** Usado quando o próprio asset contém verdes, evitando falhas no recorte por chroma. */
const MAGENTA = '#FF00FF';

type AssetSeed = Pick<AssetSpec, 'id' | 'title' | 'subject'> & { chroma?: string };

function build(category: AssetCategory, seeds: readonly AssetSeed[]): AssetSpec[] {
  const rule = CATEGORY_RULES[category];
  return seeds.map((seed) => ({
    id: seed.id,
    category,
    title: seed.title,
    subject: seed.subject,
    file: `${rule.folder}/${seed.id}.png`,
    width: rule.width,
    height: rule.height,
    transparent: rule.transparent,
    chroma: seed.chroma ?? GREEN,
  }));
}

export const ASSETS: readonly AssetSpec[] = [
  ...build('hunter', [
    {
      id: 'hunter_guardian',
      title: 'Caçador — Guardião',
      subject:
        'A broad-shouldered rift hunter in heavy dark steel plate armor worn over a modern tactical bodysuit, holding a large broadsword with a faint cyan glowing edge in both hands, short hair, determined expression, navy cloth sash at the waist.',
    },
    {
      id: 'hunter_blade',
      title: 'Caçador — Lâmina',
      subject:
        'A lean, agile rift hunter in a fitted dark hooded jacket and light leather armor straps, holding two short curved daggers with violet glowing edges in a low reverse grip, hood down, sharp focused eyes, slightly crouched stance.',
    },
    {
      id: 'hunter_arcanist',
      title: 'Caçador — Arcanista',
      subject:
        'A rift hunter spellcaster in a long dark asymmetrical coat with glowing violet rune embroidery, holding a tall metal staff topped with a floating cyan crystal, one hand raised with small arcane sparks, calm confident expression.',
    },
    {
      id: 'hunter_marksman',
      title: 'Caçador — Atirador',
      subject:
        'A rift hunter archer in a dark sleeveless tactical vest with a single shoulder guard and a quiver on the back, holding a tall recurve longbow with a cyan glowing string, arrow nocked and pointing forward-down, steady stance.',
    },
    {
      id: 'hunter_cleric',
      title: 'Caçador — Clérigo',
      subject:
        'A rift hunter battle cleric in a white and navy armored robe with silver trim, holding a flanged mace in one hand and a small round shield with a glowing violet sun emblem shape in the other, serene resolute expression.',
    },
  ]),
  ...build('monster', [
    {
      id: 'monster_rust_rat',
      title: 'Rato de Ferrugem (Rank E)',
      subject:
        'A dog-sized mutant rat with patches of rusty metal plates fused into its fur, glowing orange eyes, bare scaly tail, bared incisors.',
    },
    {
      id: 'monster_crystal_grub',
      title: 'Larva de Cristal (Rank E)',
      subject:
        'A fat pale segmented grub the size of a barrel with jagged cyan crystals growing along its back, small mandibles, tiny stubby legs.',
    },
    {
      id: 'monster_lantern_toad',
      title: 'Sapo-Lanterna (Rank D)',
      chroma: MAGENTA,
      subject:
        'A large bloated swamp toad with dull olive-grey warty skin and a glowing pale-yellow lantern lure hanging from a stalk on its forehead, wide mouth, heavy-lidded eyes.',
    },
    {
      id: 'monster_mire_stalker',
      title: 'Espreitador do Lodo (Rank D)',
      chroma: MAGENTA,
      subject:
        'A thin hunched humanoid swamp creature made of dripping dark mud and tangled reeds, long clawed arms reaching the ground, two small glowing white eyes, no visible mouth.',
    },
    {
      id: 'monster_stone_sentinel',
      title: 'Sentinela de Pedra (Rank C)',
      subject:
        'A bulky humanoid construct built from cracked grey temple stone blocks covered in barnacles, a single glowing cyan rune eye in the chest, massive fists, short legs.',
    },
    {
      id: 'monster_hollow_archer',
      title: 'Arqueiro Oco (Rank C)',
      subject:
        'An empty suit of corroded bronze armor animated by violet mist leaking from its joints, no body inside, drawing a spectral bow, tattered cloth hanging from the helmet.',
    },
    {
      id: 'monster_rime_wolf',
      title: 'Lobo de Geada (Rank B)',
      subject:
        'A large lean wolf with white-blue fur hardened into icy spikes along the spine, frosty breath, pale glowing blue eyes, snarling low stance.',
    },
    {
      id: 'monster_frost_shaman',
      title: 'Xamã do Gelo (Rank B)',
      subject:
        'A tall gaunt blue-skinned humanoid shaman wrapped in grey furs and bone charms, wearing an antlered skull mask, holding a gnarled staff with a floating shard of ice at its tip.',
    },
    {
      id: 'monster_ember_knight',
      title: 'Cavaleiro de Brasa (Rank A)',
      subject:
        'A heavily armored knight in scorched black plate armor with glowing orange cracks like cooling lava, flames flickering inside the closed visor, holding a jagged greatsword that smolders.',
    },
    {
      id: 'monster_soot_imp',
      title: 'Diabrete de Fuligem (Rank A)',
      subject:
        'A small wiry imp made of black soot and smoke with glowing ember eyes and a wide jagged grin, short horns, hovering slightly with a trailing smoke tail, holding a small ball of fire.',
    },
    {
      id: 'monster_star_eater',
      title: 'Devorador Estelar (Rank S)',
      subject:
        'A massive eyeless beast with a body like a dark starry night sky, a huge circular maw ringed with crystalline teeth, four thick limbs, tiny points of light drifting inside its translucent skin.',
    },
    {
      id: 'monster_void_watcher',
      title: 'Vigia do Vazio (Rank S)',
      subject:
        'A floating slender robed figure with no face, a single large vertical violet eye where the head should be, long sleeves ending in drifting ribbons of darkness, three thin halo rings orbiting behind it.',
    },
  ]),
  ...build('boss', [
    {
      id: 'monster_plated_alpha',
      title: 'Guardião — Alfa Couraçado (Rank E)',
      subject:
        'A bear-sized alpha mutant rat completely covered in overlapping rusted iron plates like an armadillo, scarred snout, one broken tusk-like incisor, glowing red-orange eyes, thick spiked tail.',
    },
    {
      id: 'monster_bog_hydra',
      title: 'Guardião — Hidra do Brejo (Rank D)',
      chroma: MAGENTA,
      subject:
        'A three-headed swamp hydra with dark olive-grey scaled necks rising from a mossy bulky body, each head with pale glowing yellow eyes and dripping jaws, hanging vines and mud on its back.',
    },
    {
      id: 'monster_runic_colossus',
      title: 'Guardião — Colosso Rúnico (Rank C)',
      subject:
        'A towering ancient stone colossus with a broad torso carved with glowing cyan runes, a crown-like ring of broken pillars on its shoulders, one arm ending in a giant stone hammer, moss and coral on its legs.',
    },
    {
      id: 'monster_glacial_wyrm',
      title: 'Guardião — Wyrm Glacial (Rank B)',
      subject:
        'A long wingless serpentine ice dragon coiled upright, translucent blue ice-plate scales, a crest of jagged icicle horns, cold mist pouring from its jaws, pale glowing eyes.',
    },
    {
      id: 'monster_pyre_tyrant',
      title: 'Guardião — Tirano da Pira (Rank A)',
      subject:
        'A huge horned warlord in molten black-and-gold armor with a mantle of living flames, a burning crown fused to its helmet, gripping a colossal flaming halberd, embers rising around it.',
    },
    {
      id: 'monster_eclipse_herald',
      title: 'Guardião — Arauto do Eclipse (Rank S)',
      subject:
        'A majestic terrifying winged entity in ornate dark armor, its head replaced by a black eclipsed sun with a thin blazing violet corona, six tattered wings of shadow, holding a long spear of pure white light.',
    },
  ]),
  ...build('background', [
    {
      id: 'bg_title',
      title: 'Fundo — Tela inicial',
      subject:
        'A rain-soaked modern city rooftop at night overlooking a skyline, with a gigantic vertical glowing violet-cyan rift tearing open the sky in the distance, dramatic clouds spiraling around it.',
    },
    {
      id: 'bg_hollow_tunnels',
      title: 'Fundo — Túneis Ocos (Rank E)',
      subject:
        'An abandoned underground subway tunnel with cracked tiled walls, rusted rails, flickering emergency lights, and small cyan crystals growing from the concrete.',
    },
    {
      id: 'bg_ashen_marsh',
      title: 'Fundo — Pântano Cinzento (Rank D)',
      subject:
        'A fog-covered grey swamp at dusk with dead twisted trees, still dark water, floating pale-yellow will-o-wisp lights, and a muddy path across the foreground.',
    },
    {
      id: 'bg_sunken_ruins',
      title: 'Fundo — Ruínas Afundadas (Rank C)',
      subject:
        'A half-flooded ancient temple hall with broken columns, shafts of teal light coming through the collapsed ceiling, faintly glowing cyan runes on the walls, wet stone floor.',
    },
    {
      id: 'bg_shattered_tundra',
      title: 'Fundo — Tundra Estilhaçada (Rank B)',
      subject:
        'A frozen plain under a dark aurora sky, the ice ground split by deep glowing blue fissures, jagged ice spires in the distance, blowing snow.',
    },
    {
      id: 'bg_cinder_citadel',
      title: 'Fundo — Cidadela de Cinzas (Rank A)',
      subject:
        'The courtyard of a burnt black stone fortress with glowing embers in the cracks of the flagstones, falling ash, distant towers lit by orange fire against a smoke-filled sky.',
    },
    {
      id: 'bg_void_threshold',
      title: 'Fundo — Limiar do Vazio (Rank S)',
      subject:
        'A platform of floating shattered obsidian slabs suspended in a starless void, a huge black eclipsed sun with a violet corona on the horizon, drifting fragments and thin streams of light.',
    },
  ]),
  ...build('item', [
    {
      id: 'item_weapon_guardian',
      title: 'Item — Espada Larga',
      subject: 'A heavy steel broadsword with a wide blade, dark leather-wrapped grip and a faint cyan glow along the edge.',
    },
    {
      id: 'item_weapon_blade',
      title: 'Item — Adagas Gêmeas',
      subject: 'A pair of short curved daggers crossed over each other, dark metal blades with violet glowing edges.',
    },
    {
      id: 'item_weapon_arcanist',
      title: 'Item — Cajado Rúnico',
      subject: 'A tall dark metal staff engraved with runes, topped with a floating cyan crystal held by three prongs.',
    },
    {
      id: 'item_weapon_marksman',
      title: 'Item — Arco Longo',
      subject: 'A tall dark recurve longbow with metal reinforcements and a glowing cyan bowstring.',
    },
    {
      id: 'item_weapon_cleric',
      title: 'Item — Maça Consagrada',
      subject: 'A silver flanged mace with a navy leather grip and a small violet gem set in the head.',
    },
    {
      id: 'item_armor',
      title: 'Item — Armadura',
      subject: 'A dark steel chest plate armor piece with layered shoulder guards and thin cyan glowing seams, shown empty with no body.',
    },
    {
      id: 'item_accessory',
      title: 'Item — Acessório',
      subject: 'A silver ring set with a faceted glowing violet gemstone, small engraved runes around the band.',
    },
  ]),
  ...build('icon', [
    { id: 'icon_gold', title: 'Ícone — Ouro', subject: 'A small stack of three shiny gold coins with a simple rift-shaped notch engraved on the top coin.' },
    { id: 'icon_essence', title: 'Ícone — Essência', subject: 'A teardrop-shaped crystal vial filled with swirling glowing violet smoke, sealed with a dark metal cap.' },
    { id: 'icon_str', title: 'Ícone — Força', subject: 'A clenched armored gauntlet fist, red-orange accent glow.' },
    { id: 'icon_agi', title: 'Ícone — Agilidade', subject: 'A winged boot in motion, chartreuse-yellow accent glow.', chroma: MAGENTA },
    { id: 'icon_int', title: 'Ícone — Inteligência', subject: 'An open spellbook with a small star-shaped spark rising from its pages, cyan accent glow.' },
    { id: 'icon_vit', title: 'Ícone — Vitalidade', subject: 'A faceted heart-shaped crystal, crimson accent glow.' },
  ]),
  ...build('ui', [
    {
      id: 'ui_logo',
      title: 'UI — Emblema do jogo',
      subject:
        'A heraldic emblem of a vertical jagged glowing violet-cyan rift splitting a dark shield, with two crossed blades behind the shield and small shards floating around the rift.',
    },
  ]),
];

const assetIndex = new Map(ASSETS.map((asset) => [asset.id, asset] as const));

export function findAsset(id: string): AssetSpec | undefined {
  return assetIndex.get(id);
}

/**
 * Monta o prompt completo e autossuficiente de um asset. Todos os blocos
 * (estilo, enquadramento, fundo, restrições) são repetidos em cada prompt
 * de propósito: assim cada um pode ser colado isoladamente no gerador.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function buildPrompt(asset: AssetSpec): string {
  const rule = CATEGORY_RULES[asset.category];
  const background = asset.transparent
    ? `Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid ${asset.chroma} background with no gradient, no texture, no floor and no shadow.`
    : 'Background: this image IS the background; fill the entire 16:9 canvas edge to edge with no borders or vignette frame.';
  return [STYLE_BIBLE, rule.framing, `Subject: ${asset.subject}`, background, AVOID_LINE].join('\n\n');
}
