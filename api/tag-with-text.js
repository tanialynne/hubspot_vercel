export default async function handler(req, res) {
  const allowedOrigins = [
    'https://www.heroic.us',
    'https://45764384.hs-sites.com'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, tags } = req.body;
  const apiKey = process.env.ACTIVE_CAMPAIGN_API_KEY;
  const apiBase = process.env.ACTIVE_CAMPAIGN_API_BASE;

  if (!email || !Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing email or tags array' });
  }

  try {
    // Find or create contact
    let contactId;
    const contactRes = await fetch(`${apiBase}/api/3/contacts?email=${encodeURIComponent(email)}`, {
      headers: { 'Api-Token': apiKey }
    });
    const contactData = await contactRes.json();

    if (contactData.contacts?.length > 0) {
      contactId = contactData.contacts[0].id;
    } else {
      const createRes = await fetch(`${apiBase}/api/3/contacts`, {
        method: 'POST',
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contact: { email } })
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.contact?.id) {
        return res.status(500).json({ success: false, message: 'Failed to create contact', createData });
      }
      contactId = createData.contact.id;
    }

    // Apply each tag
    const results = [];
    for (const tagName of tags) {
      let tagId;
      const findTagRes = await fetch(`${apiBase}/api/3/tags?search=${encodeURIComponent(tagName)}`, {
        headers: { 'Api-Token': apiKey }
      });
      const findTagData = await findTagRes.json();

      if (findTagData.tags?.length > 0) {
        tagId = findTagData.tags[0].id;
      } else {
        const createTagRes = await fetch(`${apiBase}/api/3/tags`, {
          method: 'POST',
          headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tag: {
              tag: tagName,
              tagType: "contact",
              description: "Created via API"
            }
          })
        });
        const createTagData = await createTagRes.json();
        if (!createTagRes.ok || !createTagData.tag?.id) {
          results.push({ tagName, success: false, message: 'Failed to create tag', createTagData });
          continue;
        }
        tagId = createTagData.tag.id;
      }

      const tagRes = await fetch(`${apiBase}/api/3/contactTags`, {
        method: 'POST',
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactTag: {
            contact: contactId,
            tag: tagId
          }
        })
      });
      const tagData = await tagRes.json();
      if (!tagRes.ok) {
        results.push({ tagName, success: false, message: 'Failed to apply tag', tagData });
      } else {
        results.push({ tagName, success: true, tagData });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
  console.error('🔥 Server error:', err);
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://www.heroic.us');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(500).json({ success: false, message: 'fetch failed', error: err.message, stack: err.stack });
}
}
