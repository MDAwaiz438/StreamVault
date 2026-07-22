'use client';
import EmbedPlayer from '../../../../../../components/EmbedPlayer';

export default function TVEmbedPage({ params }) {
  return <EmbedPlayer mediaType="tv" tmdbId={params.id} season={params.s} episode={params.e} />;
}
