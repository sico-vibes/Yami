param([string]$Query = '', [string]$Scope = '')
$ErrorActionPreference = 'Stop'
# Windows Search (the indexer Explorer uses) for the launcher: file names
# that start with or contain the words, under one folder, newest first.
# The caller has already removed quotes and wildcards from the query.
try {
  $words = @($Query -split '\s+' | Where-Object { $_ -match '^[^''"*%\[\]]{1,64}$' } | Select-Object -First 4)
  if (-not $words.Count -or -not $Scope) { '[]'; exit }
  $match = ($words | ForEach-Object { "System.FileName LIKE '%" + $_.Replace("'", "''") + "%'" }) -join ' AND '
  $scopeUrl = 'file:' + $Scope.Replace('\', '/').Replace("'", "''")
  $sql = "SELECT TOP 20 System.ItemPathDisplay, System.FileName FROM SystemIndex WHERE SCOPE='$scopeUrl' AND $match ORDER BY System.DateModified DESC"
  $conn = New-Object -ComObject ADODB.Connection
  $rs = New-Object -ComObject ADODB.Recordset
  $conn.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
  $rs.Open($sql, $conn)
  $out = @()
  while (-not $rs.EOF) {
    $out += @{ path = [string]$rs.Fields.Item('System.ItemPathDisplay').Value; name = [string]$rs.Fields.Item('System.FileName').Value }
    $rs.MoveNext()
  }
  $rs.Close(); $conn.Close()
  ConvertTo-Json -InputObject @($out) -Compress
} catch { '[]' }
