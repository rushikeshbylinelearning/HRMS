const countryCodes = [
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬' },
    { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
    { code: '+66', country: 'Thailand', flag: '🇹🇭' },
    { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
    { code: '+86', country: 'China', flag: '🇨🇳' },
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+82', country: 'South Korea', flag: '🇰🇷' }
];

const CountryCodeSelect = ({ value, onChange }) => {
    return (
        <select 
            value={value || '+91'} 
            onChange={onChange}
            style={{
                padding: '10px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '13px',
                background: 'white',
                width: '100%',
                cursor: 'pointer'
            }}
        >
            {countryCodes.map((country) => (
                <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                </option>
            ))}
        </select>
    );
};

export default CountryCodeSelect;
