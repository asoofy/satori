import taxonomy from "@/content/taxonomy.json";

export type Section = "RW" | "MATH";

export interface SkillInfo {
  id: string;
  name: string;
  section: Section;
  domain: string;
  domainName: string;
  sort: number;
}

export interface DomainInfo {
  id: string;
  name: string;
  section: Section;
  skills: SkillInfo[];
}

export const SECTION_NAMES: Record<Section, string> = {
  RW: "Reading and Writing",
  MATH: "Math",
};

export const DOMAINS: DomainInfo[] = (["RW", "MATH"] as Section[]).flatMap((section) =>
  taxonomy[section].map((d) => ({
    id: d.id,
    name: d.name,
    section,
    skills: [] as SkillInfo[],
  })),
);

export const SKILLS: SkillInfo[] = [];
{
  let sort = 0;
  for (const section of ["RW", "MATH"] as Section[]) {
    for (const d of taxonomy[section]) {
      const domain = DOMAINS.find((x) => x.id === d.id)!;
      for (const s of d.skills) {
        const info = { id: s.id, name: s.name, section, domain: d.id, domainName: d.name, sort: sort++ };
        SKILLS.push(info);
        domain.skills.push(info);
      }
    }
  }
}

export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
export const DOMAIN_BY_ID = new Map(DOMAINS.map((d) => [d.id, d]));
