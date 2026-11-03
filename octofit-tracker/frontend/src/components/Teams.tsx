import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';
import { CapabilityCard } from './CapabilityCard.js';

type TeamRecord = { name: string; mascot?: string; members?: Array<string | { _id?: string; toString?: () => string }> };

export default function Teams() {
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await getJson<{ teams: TeamRecord[] }>('/api/teams');
        if (!active) return;
        setTeams(payload.teams ?? []);
        setError(null);
      } catch {
        if (!active) return;
        setError('Unable to load teams.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <CapabilityCard title="Teams" description="Manage teams and members.">
        <p role="status">Loading teams...</p>
      </CapabilityCard>
    );
  }

  if (error) {
    return (
      <CapabilityCard title="Teams" description="Manage teams and members.">
        <div role="alert">{error}</div>
      </CapabilityCard>
    );
  }

  if (teams.length === 0) {
    return (
      <CapabilityCard title="Teams" description="Manage teams and members.">
        <p>No teams.</p>
      </CapabilityCard>
    );
  }

  return (
    <CapabilityCard title="Teams" description="Manage teams and members.">
      <ul className="list-group list-group-flush">
        {teams.map((team, index) => (
          <li key={`${team.name}-${index}`} className="list-group-item">
            <strong>{team.name}</strong> ({team.mascot ?? 'Mascot'}) · {Array.isArray(team.members) ? team.members.length : 0} members
          </li>
        ))}
      </ul>
    </CapabilityCard>
  );
}
