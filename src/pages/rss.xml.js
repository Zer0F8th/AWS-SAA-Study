import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { lectureHref, publishedLectures } from '../lib/lectures';
import { withBase } from '../lib/urls';

export async function GET(context) {
  const lectures = publishedLectures(await getCollection('lectures'));
  return rss({
    title: 'AWS SAA Field Notes',
    description: 'Practical lecture notes for the AWS Certified Solutions Architect – Associate exam.',
    site: new URL(withBase('/'), context.site),
    items: lectures.map((lecture) => ({
      title: lecture.data.title,
      description: lecture.data.description,
      pubDate: lecture.data.publishedAt,
      link: lectureHref(lecture),
      categories: [lecture.data.domain, ...lecture.data.tags],
    })),
  });
}
