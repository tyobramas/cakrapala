import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cakrapala.com';
  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/solar-system`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/osint`,
      lastModified,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/osint/sumber`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/sky`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/iss`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/codex`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
