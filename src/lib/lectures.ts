import type { CollectionEntry } from 'astro:content';
import { withBase } from './urls';

export type Lecture = CollectionEntry<'lectures'>;
export type DomainKey = Lecture['data']['domain'];

export const domainMeta: Record<
  DomainKey,
  { label: string; shortLabel: string; number: string; weight: string; description: string }
> = {
  secure: {
    label: 'Design Secure Architectures',
    shortLabel: 'Secure',
    number: '01',
    weight: '30%',
    description: 'Identity, workload protection, and controls for data at rest and in transit.',
  },
  resilient: {
    label: 'Design Resilient Architectures',
    shortLabel: 'Resilient',
    number: '02',
    weight: '26%',
    description: 'Loose coupling, high availability, fault tolerance, and recovery patterns.',
  },
  performance: {
    label: 'Design High-Performing Architectures',
    shortLabel: 'Performance',
    number: '03',
    weight: '24%',
    description: 'Elastic compute, scalable storage, databases, networking, and data ingestion.',
  },
  cost: {
    label: 'Design Cost-Optimized Architectures',
    shortLabel: 'Cost',
    number: '04',
    weight: '20%',
    description: 'Right-sized storage, compute, databases, and network transfer choices.',
  },
};

export function sortLectures(lectures: Lecture[]) {
  return [...lectures].sort((a, b) => a.data.order - b.data.order);
}

export function publishedLectures(lectures: Lecture[]) {
  return sortLectures(lectures.filter((lecture) => !lecture.data.draft));
}

export function lectureHref(lecture: Lecture) {
  return withBase(`/lectures/${lecture.id}/`);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function estimateReadingTime(body = '') {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}
