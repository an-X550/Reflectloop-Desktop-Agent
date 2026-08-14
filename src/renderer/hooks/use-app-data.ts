import { useCallback, useEffect, useState } from 'react';
import type { DataDirectoryInfo, Journal, Project, PublicProviderConfig, Review } from '../../shared/schemas/domain';

export function useAppData() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [settings, setSettings] = useState<PublicProviderConfig | null>(null);
  const [dataDirectory, setDataDirectory] = useState<DataDirectoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setError('');
    try {
      const [nextJournals, nextProjects, nextReviews, nextSettings, nextDirectory] = await Promise.all([window.zhiji.journals.list(), window.zhiji.projects.list(), window.zhiji.reviews.list(), window.zhiji.settings.getPublicConfig(), window.zhiji.dataDirectory.getInfo()]);
      setJournals(nextJournals); setProjects(nextProjects); setReviews(nextReviews); setSettings(nextSettings); setDataDirectory(nextDirectory);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '无法读取本地数据'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  // hasApiKey 在此派生一次，页面直接使用，不再各自重复计算
  return { journals, projects, reviews, settings, dataDirectory, loading, error, refresh, hasApiKey: Boolean(settings?.hasApiKey) };
}
