"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Project {
  id: string;
  name: string;
  domain: string;
}

export function ProjectSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentProjectId = searchParams.get("projectId") ?? "";
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/projects?pageSize=100");
      const json = await res.json();
      setProjects(json.data ?? []);
    })();
  }, []);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("projectId", value);
    } else {
      params.delete("projectId");
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={currentProjectId}
      onChange={onChange}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
    >
      <option value="">-- 选择项目 --</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.domain})
        </option>
      ))}
    </select>
  );
}
