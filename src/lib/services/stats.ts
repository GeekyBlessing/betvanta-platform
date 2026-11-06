import { one } from "../db";
/** A win rate is only shown once enough picks have settled to mean something. */
export const MIN_SETTLED_FOR_RATE = 20;
export type HomeStats = { members: number; settled: number; won: number; lost: number; winRate: number | null; sports: number; sampleData: boolean };

/** Every figure comes from the database. Nothing is estimated or padded. */
export async function homeStats(): Promise<HomeStats> {
  const r = await one<{ members: number; won: number; lost: number; voided: number; sports: number; mock_preds: number; mock_comps: number }>(`select
    (select count(*)::int from users where role = 'member' and status = 'active') members,
    (select count(*)::int from predictions where status = 'settled' and result = 'won') won,
    (select count(*)::int from predictions where status = 'settled' and result = 'lost') lost,
    (select count(*)::int from predictions where status = 'settled' and result = 'void') voided,
    (select count(distinct c.sport)::int from competitions c where c.active and exists (select 1 from fixtures f where f.competition_id = c.id)) sports,
    (select count(*)::int from predictions p join fixtures f on f.id = p.fixture_id where p.status = 'settled' and f.data_source = 'mock') mock_preds,
    (select count(*)::int from competitions where active and data_source = 'mock') mock_comps`);
  const decided = r!.won + r!.lost;
  return {
    members: r!.members, won: r!.won, lost: r!.lost, settled: decided + r!.voided, sports: r!.sports,
    winRate: decided >= MIN_SETTLED_FOR_RATE ? (r!.won / decided) * 100 : null,
    sampleData: r!.mock_preds > 0 || r!.mock_comps > 0,
  };
}
