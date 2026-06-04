export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const INSTANTLY_KEY = process.env.INSTANTLY_API_KEY;
  if (!INSTANTLY_KEY) return res.status(500).json({ error: 'Missing INSTANTLY_API_KEY' });

  try {
    // Fetch campaigns
    const campRes = await fetch('https://api.instantly.ai/api/v2/campaigns?limit=20&status=1', {
      headers: { Authorization: `Bearer ${INSTANTLY_KEY}` }
    });
    const campData = await campRes.json();
    const campaigns = campData.items || [];

    // Fetch leads for each campaign
    let allLeads = [];
    for (const camp of campaigns) {
      const leadsRes = await fetch(`https://api.instantly.ai/api/v2/leads?campaign_id=${camp.id}&limit=100`, {
        headers: { Authorization: `Bearer ${INSTANTLY_KEY}` }
      });
      const leadsData = await leadsRes.json();
      const leads = (leadsData.items || []).map(l => ({
        ...l,
        campaign_name: camp.name,
        campaign_id: camp.id
      }));
      allLeads = [...allLeads, ...leads];
    }

    // Fetch analytics for each campaign
    let analytics = [];
    for (const camp of campaigns) {
      const aRes = await fetch(`https://api.instantly.ai/api/v2/campaigns/${camp.id}/analytics`, {
        headers: { Authorization: `Bearer ${INSTANTLY_KEY}` }
      });
      const aData = await aRes.json();
      analytics.push({ campaign_id: camp.id, campaign_name: camp.name, ...aData });
    }

    return res.status(200).json({ campaigns, leads: allLeads, analytics });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
