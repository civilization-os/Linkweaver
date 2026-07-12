$projId = "proj-18c160f588d217bc"

Write-Host "Adding User actor..."
$userBody = '{"type":"actor","label":"前端用户","sublabel":"Actor","x":150,"y":250}'
$resUser = Invoke-RestMethod -Method Post -Uri "http://localhost:8081/api/projects/$projId/nodes" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($userBody))
$userId = $resUser.id
Write-Host "User Actor ID: $userId"

Write-Host "Adding Order Service process..."
$orderBody = '{"type":"process","label":"订单服务","sublabel":"Process","x":450,"y":250,"fields":[{"name":"orderId","type":"string"},{"name":"amount","type":"number"}]}'
$resOrder = Invoke-RestMethod -Method Post -Uri "http://localhost:8081/api/projects/$projId/nodes" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($orderBody))
$orderId = $resOrder.id
Write-Host "Order Service ID: $orderId"

Write-Host "Adding Order Database entity..."
$dbBody = '{"type":"entity","label":"订单数据库","sublabel":"Entity","x":750,"y":250,"fields":[{"name":"id","type":"string"},{"name":"status","type":"string"}]}'
$resDb = Invoke-RestMethod -Method Post -Uri "http://localhost:8081/api/projects/$projId/nodes" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($dbBody))
$dbId = $resDb.id
Write-Host "Database ID: $dbId"

Write-Host "Adding flow: User -> Order Service..."
$flow1 = '{"sourceId":"' + $userId + '","sourcePort":"r","targetId":"' + $orderId + '","targetPort":"l","label":"提交订单请求","dir":"fwd"}'
Invoke-RestMethod -Method Post -Uri "http://localhost:8081/api/projects/$projId/edges" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($flow1))

Write-Host "Adding flow: Order Service -> Order Database..."
$flow2 = '{"sourceId":"' + $orderId + '","sourcePort":"r","targetId":"' + $dbId + '","targetPort":"l","label":"写入订单记录","dir":"fwd"}'
Invoke-RestMethod -Method Post -Uri "http://localhost:8081/api/projects/$projId/edges" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($flow2))

Write-Host "Demo project populated successfully!"
