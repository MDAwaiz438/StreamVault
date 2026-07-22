'use client';
import EmbedPlayer from '../../../../components/EmbedPlayer';

export default function MovieEmbedPage({ params }) {
  return <EmbedPlayer mediaType="movie" tmdbId={params.id} season="1" episode="1" />;
}
