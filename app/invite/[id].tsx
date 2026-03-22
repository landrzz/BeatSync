import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button, Card, Field, Label, Muted, Screen } from '@/components/ui';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const createInvite = useMutation(api.invites.createInvite);
  const acceptInvite = useMutation(api.invites.acceptInvite);
  const [email, setEmail] = useState('friend@example.com');
  const [token, setToken] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const onCreate = async () => {
    const invite = await createInvite({ playlistId: id as any, email });
    setToken(invite.token);
    setResult(invite.reused ? 'Reused an existing pending invite.' : 'Invite created. Share the token or wrap it in a deep link.');
  };

  const onAccept = async () => {
    const response = await acceptInvite({ token });
    setResult(response.alreadyAccepted ? 'Invite was already accepted.' : `Joined playlist ${response.playlistId}.`);
  };

  return (
    <Screen>
      <Card title="Invite collaborator" subtitle="MVP flow uses an email + token invite.">
        <Label>Email</Label>
        <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Button title="Create invite" onPress={onCreate} />
      </Card>

      <Card title="Accept invite token" subtitle="Useful for testing with two accounts.">
        <Label>Token</Label>
        <Field value={token} onChangeText={setToken} autoCapitalize="none" />
        <Button title="Accept invite" onPress={onAccept} />
        {token ? <Muted selectable>{token}</Muted> : null}
      </Card>

      {result ? <Card title="Result"><Muted>{result}</Muted></Card> : null}
    </Screen>
  );
}
