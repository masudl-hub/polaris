from pytrends.request import TrendReq
pytrends = TrendReq(hl='en-US', tz=360)
pytrends.build_payload(['Boredom', 'Humor', 'Sarcasm', 'Internet', 'Comedy'], cat=0, timeframe='today 3-m', geo='US')
ibr = pytrends.interest_by_region(resolution='COUNTRY', inc_low_vol=False)
print("Columns:", ibr.columns.tolist())
try:
    print(ibr.head())
    print("Largest by first col:")
    print(ibr.nlargest(5, ibr.columns[0]))
    print("Mean of all cols:")
    avg = ibr.mean(axis=1)
    print(avg.nlargest(5))
except Exception as e:
    print(e)
