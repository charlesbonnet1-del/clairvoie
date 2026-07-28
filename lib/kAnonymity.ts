import { K_ANONYMITY_THRESHOLD } from "@/config";

export interface GeoLocatable {
  commune: string;
  epci: string;
  departement: string;
}

export type Maille = "commune" | "epci" | "departement";

export interface AggregatedGroup {
  maille: Maille;
  label: string;
  count: number;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key);
    if (arr) {
      arr.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

/**
 * Applique le seuil de k-anonymité (principe 4) : toute maille géographique
 * comptant moins de `threshold` cas est remontée au niveau supérieur
 * (commune -> EPCI -> département). Le département est le repli final et
 * est toujours affiché, quel que soit son effectif, faute de maille plus
 * large disponible dans le périmètre national.
 *
 * Fonction pure — ne touche pas la base de données — pour rester testable
 * unitairement et être appelée depuis l'API du tableau de bord.
 */
export function applyKAnonymity<T extends GeoLocatable>(
  items: T[],
  threshold: number = K_ANONYMITY_THRESHOLD
): AggregatedGroup[] {
  const result: AggregatedGroup[] = [];

  const byCommune = groupBy(items, (i) => i.commune);
  const remontesVersEpci: T[] = [];
  for (const [commune, group] of byCommune) {
    if (group.length >= threshold) {
      result.push({ maille: "commune", label: commune, count: group.length });
    } else {
      remontesVersEpci.push(...group);
    }
  }

  const byEpci = groupBy(remontesVersEpci, (i) => i.epci);
  const remontesVersDept: T[] = [];
  for (const [epci, group] of byEpci) {
    if (group.length >= threshold) {
      result.push({ maille: "epci", label: epci, count: group.length });
    } else {
      remontesVersDept.push(...group);
    }
  }

  const byDept = groupBy(remontesVersDept, (i) => i.departement);
  for (const [departement, group] of byDept) {
    result.push({ maille: "departement", label: departement, count: group.length });
  }

  return result;
}
